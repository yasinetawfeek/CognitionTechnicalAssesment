/**
 * App registry. Add your app's manifest here (or run `npm run create-app <id>`).
 * Order controls sidebar / App Store order. Kernel-category apps go in the sidebar; everything
 * else is installed and launched from the Apps hub (/apps).
 */
import type { AppManifest } from "@/kernel/apps/types";
import { appsHubApp } from "./apps/manifest";
import { playgroundApp } from "./playground/manifest";
import { approvalsApp } from "./approvals/manifest";
import { flagsApp } from "./flags/manifest";
import { builderApp } from "./builder/manifest";
import { adminApp } from "./admin/manifest";
import { auditApp } from "./audit/manifest";
import { systemApp } from "./system/manifest";
import { deadlinesApp } from "./deadlines/manifest";
import { kycApp } from "./kyc/manifest";

export const apps: AppManifest[] = [appsHubApp, playgroundApp, builderApp, approvalsApp, flagsApp, adminApp, auditApp, systemApp, kycApp, deadlinesApp];
