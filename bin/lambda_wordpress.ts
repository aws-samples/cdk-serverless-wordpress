#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LambdaWordpressStack } from '../lib/lambda_wordpress-stack';

const app = new cdk.App();
new LambdaWordpressStack(app, 'LambdaWordpressStack');
