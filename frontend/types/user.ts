// types/user.ts
// 백엔드 schemas.py와 1:1 대응하는 TypeScript 타입 정의

export type Gender = "MALE" | "FEMALE";
export type SmokingStatus = "NON_SMOKER" | "SMOKER";

/** POST /api/users 요청 페이로드 */
export interface UserCreatePayload {
    // 필수
    name: string;
    gender: Gender;
    birth_year: number;
    job: string;
    contact: string;
    password: string;
    referrer_name: string;
    desired_conditions: string;
    deal_breakers: string;
    // 선택
    instagram_id?: string;
    photo_urls?: string[];  // 업로드된 사진 URL 목록 (최대 10장)
    height?: number;
    active_area?: string;
    education?: string;
    workplace?: string;
    mbti?: string;
    smoking_status?: SmokingStatus;
    religion?: string;
}

/** PUT /api/users/{user_id} 요청 페이로드 – 모든 필드 Optional */
export interface UserUpdatePayload {
    name?: string;
    gender?: Gender;
    birth_year?: number;
    job?: string;
    referrer_name?: string;
    desired_conditions?: string;
    deal_breakers?: string;
    instagram_id?: string;
    photo_urls?: string[];
    height?: number;
    active_area?: string;
    education?: string;
    workplace?: string;
    mbti?: string;
    smoking_status?: SmokingStatus;
    religion?: string;
    is_active?: boolean;
}

/** POST /api/users/auth 요청 페이로드 */
export interface AuthPayload {
    contact: string;
    password: string;
}

/** POST /api/users/auth 응답 */
export interface AuthResponse {
    user_id: string;
    name: string;
}

/** 서버 응답용 유저 타입 (관리자, password_hash 제외) */
export interface UserReadAdmin extends Omit<UserCreatePayload, "password"> {
    id: string;
    contact: string;
    is_active: boolean;
}

/** GET /api/upload/presigned-url 응답 */
export interface PresignedUrlResponse {
    presigned_url: string;
    object_key: string;
    public_url: string;
}
