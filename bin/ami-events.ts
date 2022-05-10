#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AmiEventsStack } from "../lib/ami-events-stack";

const app = new cdk.App();
new AmiEventsStack(app, "AmiEventsStack");
