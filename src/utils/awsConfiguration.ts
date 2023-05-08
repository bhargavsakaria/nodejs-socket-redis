const access_key_id = process.env['S3_ACCESS_KEY'] as string;
const secret_access_key = process.env['S3_SECRET_KEY'] as string;

export const aws_region = process.env['S3_REGION'] as string;
export const aws_bucket = process.env['S3_BUCKET'] as string;

export const aws_credentials = {
  accessKeyId: access_key_id,
  secretAccessKey: secret_access_key,
  expired: false
};
