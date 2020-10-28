import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as LambdaWordpress from '../lib/lambda_wordpress-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new LambdaWordpress.LambdaWordpressStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
