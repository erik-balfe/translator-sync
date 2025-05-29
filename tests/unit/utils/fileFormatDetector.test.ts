#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import {
  detectFileFormat,
  getAllSupportedExtensions,
  getSupportedExtensions,
  isSupportedFile,
} from "../../../src/utils/fileFormatDetector";

describe("File Format Detector", () => {
  describe("detectFileFormat", () => {
    test("detects FTL from extension", () => {
      expect(detectFileFormat("en.ftl")).toBe("ftl");
      expect(detectFileFormat("messages.ftl")).toBe("ftl");
    });

    test("detects JSON from extension", () => {
      expect(detectFileFormat("en.json")).toBe("json");
      expect(detectFileFormat("translations.json")).toBe("json");
    });

    test("detects unknown format", () => {
      expect(detectFileFormat("file.txt")).toBe("unknown");
      expect(detectFileFormat("file.yaml")).toBe("unknown");
    });

    test("detects JSON from content when extension unclear", () => {
      const jsonContent = '{"hello": "world"}';
      expect(detectFileFormat("file.unknown", jsonContent)).toBe("json");
    });

    test("detects FTL from content when extension unclear", () => {
      const ftlContent = "hello = Hello world\nwelcome = Welcome {$name}";
      expect(detectFileFormat("file.unknown", ftlContent)).toBe("ftl");
    });

    test("handles case insensitive extensions", () => {
      expect(detectFileFormat("en.FTL")).toBe("ftl");
      expect(detectFileFormat("en.JSON")).toBe("json");
    });
  });

  describe("getSupportedExtensions", () => {
    test("returns correct extensions for each format", () => {
      expect(getSupportedExtensions("ftl")).toEqual([".ftl"]);
      expect(getSupportedExtensions("json")).toEqual([".json"]);
      expect(getSupportedExtensions("unknown")).toEqual([]);
    });
  });

  describe("getAllSupportedExtensions", () => {
    test("returns all supported extensions", () => {
      const extensions = getAllSupportedExtensions();
      expect(extensions).toContain(".ftl");
      expect(extensions).toContain(".json");
      expect(extensions).toHaveLength(2);
    });
  });

  describe("isSupportedFile", () => {
    test("identifies supported files", () => {
      expect(isSupportedFile("en.ftl")).toBe(true);
      expect(isSupportedFile("en.json")).toBe(true);
      expect(isSupportedFile("messages.FTL")).toBe(true);
      expect(isSupportedFile("translations.JSON")).toBe(true);
    });

    test("rejects unsupported files", () => {
      expect(isSupportedFile("file.txt")).toBe(false);
      expect(isSupportedFile("file.yaml")).toBe(false);
      expect(isSupportedFile("file.xml")).toBe(false);
      expect(isSupportedFile("file")).toBe(false);
    });
  });
});
