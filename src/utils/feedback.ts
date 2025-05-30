#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger.ts";
import { telemetry } from "./telemetry.ts";

/**
 * Smart feedback collection system that respects user time.
 *
 * Features:
 * - Only asks occasionally (every 10th use)
 * - Time-aware (not during night hours)
 * - Quick and optional
 * - Privacy-first (anonymous only)
 */

interface FeedbackState {
  totalUsages: number;
  lastFeedbackTime: number;
  feedbackCount: number;
  optedOut: boolean;
}

const FEEDBACK_STATE_FILE = ".translator-feedback.json";
const FEEDBACK_FREQUENCY = 10; // Ask every 10th usage
const MIN_TIME_BETWEEN_FEEDBACK = 7 * 24 * 60 * 60 * 1000; // 1 week
const NIGHT_HOURS_START = 22; // 10 PM
const NIGHT_HOURS_END = 7; // 7 AM

export class FeedbackCollector {
  private statePath: string;
  private state: FeedbackState;

  constructor(baseDir: string = process.cwd()) {
    this.statePath = path.join(baseDir, FEEDBACK_STATE_FILE);
    this.state = this.loadState();
  }

  /**
   * Load feedback state from file.
   */
  private loadState(): FeedbackState {
    try {
      if (fs.existsSync(this.statePath)) {
        const content = fs.readFileSync(this.statePath, "utf-8");
        const state = JSON.parse(content) as FeedbackState;
        return {
          totalUsages: state.totalUsages || 0,
          lastFeedbackTime: state.lastFeedbackTime || 0,
          feedbackCount: state.feedbackCount || 0,
          optedOut: state.optedOut || false,
        };
      }
    } catch (error) {
      logger.debug(`Could not load feedback state: ${error}`);
    }

    return {
      totalUsages: 0,
      lastFeedbackTime: 0,
      feedbackCount: 0,
      optedOut: false,
    };
  }

  /**
   * Save feedback state to file.
   */
  private saveState(): void {
    try {
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      logger.debug(`Could not save feedback state: ${error}`);
    }
  }

  /**
   * Check if it's a good time to ask for feedback.
   */
  private isGoodTimeForFeedback(): boolean {
    const now = new Date();
    const hour = now.getHours();

    // Don't ask during night hours (respect user's time)
    if (hour >= NIGHT_HOURS_START || hour < NIGHT_HOURS_END) {
      return false;
    }

    // Don't ask too frequently
    const timeSinceLastFeedback = Date.now() - this.state.lastFeedbackTime;
    if (timeSinceLastFeedback < MIN_TIME_BETWEEN_FEEDBACK) {
      return false;
    }

    // Ask every 10th usage
    return this.state.totalUsages > 0 && this.state.totalUsages % FEEDBACK_FREQUENCY === 0;
  }

  /**
   * Record a usage and possibly ask for feedback.
   */
  async recordUsage(): Promise<void> {
    this.state.totalUsages++;
    this.saveState();

    // Check if we should ask for feedback
    if (!this.state.optedOut && this.isGoodTimeForFeedback()) {
      await this.askForFeedback();
    }
  }

  /**
   * Ask for quick feedback from the user.
   */
  private async askForFeedback(): Promise<void> {
    try {
      console.log("\n📝 Quick Feedback (Optional)");
      console.log("━".repeat(30));
      console.log("How satisfied are you with TranslatorSync? (1-5, or 's' to skip)");
      console.log("1=Poor, 2=Fair, 3=Good, 4=Great, 5=Excellent");

      const scoreInput = prompt("Score (1-5) or 's' to skip: ");

      if (scoreInput === "s" || scoreInput === "skip") {
        console.log("Feedback skipped. Thanks for using TranslatorSync! 🚀");
        return;
      }

      const score = Number.parseInt(scoreInput || "0", 10);

      if (score < 1 || score > 5) {
        console.log("Invalid score. Feedback skipped.");
        return;
      }

      // Optional comment
      let comment: string | undefined;
      if (score <= 3) {
        console.log("\nWhat could we improve? (optional, press Enter to skip)");
        comment = prompt("Brief feedback: ");
      } else {
        console.log("\nAny suggestions? (optional, press Enter to skip)");
        comment = prompt("Brief feedback: ");
      }

      // Record the feedback anonymously
      telemetry.recordFeedback(score, comment || undefined);

      // Update state
      this.state.lastFeedbackTime = Date.now();
      this.state.feedbackCount++;
      this.saveState();

      console.log("✅ Thanks for the feedback! This helps improve TranslatorSync for everyone.");

      // Offer to opt out if user seems annoyed
      if (this.state.feedbackCount >= 3) {
        console.log(
          "\nTired of feedback requests? Type 'translator-sync feedback --disable' to turn them off.",
        );
      }
    } catch (error) {
      logger.debug(`Error collecting feedback: ${error}`);
    }
  }

  /**
   * Allow user to manually provide feedback.
   */
  async manualFeedback(): Promise<void> {
    console.log("\n📝 TranslatorSync Feedback");
    console.log("━".repeat(30));
    console.log("Your feedback helps improve TranslatorSync for everyone!");
    console.log("All feedback is anonymous and privacy-first.");
    console.log("");

    await this.askForFeedback();
  }

  /**
   * Disable feedback collection.
   */
  disableFeedback(): void {
    this.state.optedOut = true;
    this.saveState();
    console.log("✅ Feedback collection disabled.");
    console.log("Note: This may slow down bug fixes and improvements.");
    console.log("You can re-enable with: translator-sync feedback --enable");
  }

  /**
   * Enable feedback collection.
   */
  enableFeedback(): void {
    this.state.optedOut = false;
    this.saveState();
    console.log("✅ Feedback collection enabled.");
    console.log("We'll occasionally ask for quick feedback to improve the tool.");
  }

  /**
   * Show feedback statistics.
   */
  showStats(): void {
    console.log("\n📊 Feedback Statistics");
    console.log("━".repeat(25));
    console.log(`Total usages: ${this.state.totalUsages}`);
    console.log(`Feedback provided: ${this.state.feedbackCount} times`);
    console.log(`Status: ${this.state.optedOut ? "Disabled" : "Enabled"}`);

    if (this.state.lastFeedbackTime > 0) {
      const lastFeedback = new Date(this.state.lastFeedbackTime);
      console.log(`Last feedback: ${lastFeedback.toLocaleDateString()}`);
    }
  }

  /**
   * Get current feedback state.
   */
  getState(): Readonly<FeedbackState> {
    return { ...this.state };
  }
}

// Global feedback collector instance
let feedbackCollector: FeedbackCollector | null = null;

/**
 * Initialize feedback collection.
 */
export function initializeFeedback(baseDir?: string): FeedbackCollector {
  feedbackCollector = new FeedbackCollector(baseDir);
  return feedbackCollector;
}

/**
 * Get current feedback collector.
 */
export function getFeedbackCollector(): FeedbackCollector | null {
  return feedbackCollector;
}

/**
 * Record a usage (may trigger feedback request).
 */
export async function recordUsage(): Promise<void> {
  if (feedbackCollector) {
    await feedbackCollector.recordUsage();
  }
}
