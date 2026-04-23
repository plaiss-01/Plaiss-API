import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';

async function check() {
  const region = (process.env.S3_REGION || '').trim().replace(/^["']|["']$/g, '');
  const bucket = (process.env.S3_BUCKET || '').trim().replace(/^["']|["']$/g, '');
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim().replace(/^["']|["']$/g, '');
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim().replace(/^["']|["']$/g, '');

  console.log('Testing S3 with:', { region, bucket, accessKeyId: '***' + accessKeyId.slice(-4) });

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey }
  });

  const key = 'test-upload.txt';
  const body = 'Hello S3';

  try {
    console.log('Uploading test file...');
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'text/plain',
      ACL: 'public-read'
    }));
    console.log('Upload successful!');

    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    console.log('Generated URL:', url);

    console.log('Checking object accessibility...');
    const head = await client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    }));
    console.log('Object exists. Metadata:', head.Metadata);

  } catch (err: any) {
    console.error('S3 Test Failed:', err.message);
    if (err.name === 'AccessControlListNotSupported') {
      console.log('Bucket does not support ACLs. Trying without ACL...');
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'text/plain'
        }));
        console.log('Upload successful without ACL!');
      } catch (innerErr: any) {
        console.error('Upload still failed:', innerErr.message);
      }
    }
  }
}

check();
