"""
utils/s3.py
boto3를 사용한 S3(또는 S3 호환) 클라이언트 초기화 & Presigned URL 생성 유틸리티.
"""

import os
import uuid

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# 환경 변수 로드
# ---------------------------------------------------------------------------
AWS_ACCESS_KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION            = os.getenv("AWS_REGION", "ap-northeast-2")
S3_BUCKET_NAME        = os.getenv("S3_BUCKET_NAME")
# Cloudflare R2 / MinIO 등 S3 호환 스토리지를 사용하는 경우 설정합니다.
S3_ENDPOINT_URL       = os.getenv("S3_ENDPOINT_URL")  # None 이면 AWS S3 기본값 사용
# 최종 Public URL 기반 (CDN 또는 버킷 도메인)
S3_PUBLIC_BASE_URL    = os.getenv("S3_PUBLIC_BASE_URL")  # 예: https://cdn.example.com

# 허용 MIME 타입
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTOS            = 10


def _get_client():
    """boto3 S3 클라이언트를 반환합니다."""
    kwargs: dict = {
        "region_name": AWS_REGION,
    }
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        kwargs["aws_access_key_id"]     = AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY
    if S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


def generate_presigned_upload(
    filename: str,
    content_type: str,
    expires_in: int = 300,
) -> dict:
    """
    업로드용 Presigned URL을 생성합니다.

    Returns:
        {
            "presigned_url": str,   # 브라우저에서 PUT 요청 보낼 서명된 URL
            "object_key":   str,    # S3 오브젝트 키
            "public_url":   str,    # DB에 저장할 최종 Public URL
        }

    Raises:
        EnvironmentError: 필수 환경변수 미설정
        ValueError:       허용되지 않은 content_type 또는 파일 수 초과
        RuntimeError:     boto3 호출 실패
    """
    if not S3_BUCKET_NAME:
        raise EnvironmentError(
            "S3_BUCKET_NAME 환경변수가 설정되지 않았습니다."
        )

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(
            f"허용되지 않는 파일 형식입니다. 허용: {', '.join(ALLOWED_CONTENT_TYPES)}"
        )

    # 파일 확장자 추출 (원본 파일명에서)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    object_key = f"photos/{uuid.uuid4()}.{ext}"

    client = _get_client()
    try:
        presigned_url = client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket":      S3_BUCKET_NAME,
                "Key":         object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )
    except ClientError as e:
        raise RuntimeError(f"Presigned URL 생성 실패: {e}") from e

    # Public URL 결정
    if S3_PUBLIC_BASE_URL:
        public_url = f"{S3_PUBLIC_BASE_URL.rstrip('/')}/{object_key}"
    elif S3_ENDPOINT_URL:
        # R2 등 커스텀 엔드포인트
        public_url = f"{S3_ENDPOINT_URL.rstrip('/')}/{S3_BUCKET_NAME}/{object_key}"
    else:
        # 표준 AWS S3
        public_url = (
            f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{object_key}"
        )

    return {
        "presigned_url": presigned_url,
        "object_key":    object_key,
        "public_url":    public_url,
    }
