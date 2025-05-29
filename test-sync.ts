#!/usr/bin/env bun
import { syncTranslations } from "./src/cli/sync-simplified";

// Test with React app structure
await syncTranslations("./test-react-app/public/locales");