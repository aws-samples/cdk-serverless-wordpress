this project is archived. please check another similar project

https://github.com/aws-samples/serverless-woocommerce-workshop

# cdk-serverless-wordpress

## what does this repo do

this project help to run the serverless wordpress with AWS Lambda and AWS EFS

### init CDK project

1. run below commands to install cdk components

```ts
npm install @aws-cdk/aws-ec2 @aws-cdk/aws-efs @aws-cdk/aws-lambda @aws-cdk/aws-rds @aws-cdk/aws-elasticloadbalancingv2 @aws-cdk/aws-elasticloadbalancingv2-targets @aws-cdk/aws-secretsmanager path
```
2. find the cdk.json file, replace the domainName, keyName, dbPassword with your own value.

|  |  |
| ---------- | --- |
| domainName |  your domain name, which used to validate the certificate |
| keyName    |  the key pairs which used to login to the EC2 |
| dbPassword |  the rds password |


3. compile and deploy

```ts
npm run build
cdk deploy
```
remeber use us-east-1 region, open aws console, find Certificate Manager service and validate the certificate with DNS name, you can refer this doc https://docs.aws.amazon.com/zh_cn/acm/latest/userguide/gs-acm-validate-dns.html

you can find the EFS ID at the output

4. Launch EC2 and install wordpress on EFS

```
sudo mount -t efs YOUR_EFS_ID:/ /mnt/efs
```

you can download the wordpress package and unzip them into path /mnt/efs/wordpress
then edit below items in the wp-config.php file

```php
define( 'DB_NAME', getenv('DB_NAME') );
define( 'DB_USER', getenv('DB_USER') );
define( 'DB_PASSWORD', getenv('DB_PASSWORD') );
define( 'DB_HOST', getenv('DB_HOST') );
define('WP_SITEURL', 'https://' . getenv('HTTP_HOST') );
define('WP_HOME', 'https://' . getenv('HTTP_HOST') );
$_SERVER['HTTP_HOST'] = getenv('HTTP_HOST') ;
```
you can also download the source from below github
https://github.com/forhead/wordpressForLambda.git

5. launch the serverless wordpress with alb DNS name, you can config the dns on your own domain


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

