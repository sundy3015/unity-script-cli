#!/usr/bin/env node
import { runCli } from "./cli/cli-application.js";

const CONFIG_PATH = "unity-cli.config.json";

process.exitCode = await runCli(CONFIG_PATH);
