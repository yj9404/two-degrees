// types/user.ts
// 백엔드 schemas.py와 1:1 대응하는 TypeScript 타입 정의

export type Gender = "MALE" | "FEMALE";
export type SmokingStatus = "NON_SMOKER" | "SMOKER";
export type DrinkingStatus = "NON_DRINKER" | "SOCIAL_DRINKER" | "DRINKER";
export type MatchStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
export type MarriageIntent = "UNKNOWN" | "WILLING" | "OPEN" | "NOT_NOW" | "NON_MARRIAGE";
export type ChildPlan = "UNKNOWN" | "WANT" | "OPEN" | "NOT_NOW" | "DINK";

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
    drinking_status?: DrinkingStatus;
    religion?: string;
    exercise?: string;
    hobbies?: string;
    intro?: string;
    age_preference?: ("OLDER" | "YOUNGER" | "SAME" | "ANY")[]; // 다중 선택
    age_gap_older?: number;   // 연상 허용 최대 나이차
    age_gap_younger?: number; // 연하 허용 최대 나이차
    marriage_intent?: MarriageIntent; // 결혼 의향
    child_plan?: ChildPlan;           // 자녀 계획
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
    drinking_status?: DrinkingStatus;
    religion?: string;
    exercise?: string;
    hobbies?: string;
    intro?: string;
    age_preference?: ("OLDER" | "YOUNGER" | "SAME" | "ANY")[];
    age_gap_older?: number;
    age_gap_younger?: number;
    is_active?: boolean;
    marriage_intent?: MarriageIntent; // 결혼 의향
    child_plan?: ChildPlan;           // 자녀 계획
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
    match_count: number;
}

/** GET /api/upload/presigned-url 응답 */
export interface PresignedUrlResponse {
    presigned_url: string;
    object_key: string;
    public_url: string;
}

/** GET /api/users/stats 응답 */
export interface UserStatsResponse {
    total_active: number;
    total_users: number;
    total_matchings: number;
    male_active: number;
    female_active: number;
    male_ratio: number;
    female_ratio: number;
}

/** 매칭 생성 페이로드 */
export interface MatchingCreatePayload {
    user_a_id: string;
    user_b_id: string;
    ai_score?: number;
    ai_reason?: string;
}

/** 매칭 상태 업데이트 페이로드 */
export interface MatchingUpdatePayload {
    user_id: string;
    status: MatchStatus;
}

/** 매칭 응답 객체 */
export interface MatchingResponse {
    id: string;
    user_a_id: string;
    user_b_id: string;
    user_a_status: MatchStatus;
    user_b_status: MatchStatus;
    ai_score?: number;
    ai_reason?: string;
    created_at: string;
    user_a_token?: string;
    user_b_token?: string;
    expires_at?: string;
    is_contact_shared: boolean;
    user_a_info: UserReadAdmin;
    user_b_info: UserReadAdmin;
}

/** AI 매칭 추천 요청 페이로드 */
export interface AIRecommendRequest {
    target_user_id: string;
    candidate_user_ids: string[];
}

/** AI 매칭 추천 결과 객체 */
export interface AIRecommendResult {
    candidate_id: string;
    score: number;
    reason: string;
}

export interface Notice {
    id: number;
    title: string;
    content: string;
    is_popup: boolean;
    created_at: string;
}

/** 공유 프로필 정보 */
export interface SharedProfileRead {
    age: number;
    birth_year: number;
    job: string;
    height?: number;
    active_area?: string;
    education?: string;
    workplace?: string;
    mbti?: string;
    religion?: string;
    smoking_status?: SmokingStatus;
    drinking_status?: DrinkingStatus;
    exercise?: string;
    hobbies?: string;
    ai_reason?: string;
    photo_urls: string[];
    expires_at?: string;
}

/** 매칭 응담 요청 */
export interface MatchRespondRequest {
    status: MatchStatus;
}

/** 날짜별 매칭 통계 개별 항목 */
export interface DailyMatchingStats {
    date: string;
    count: number;
}

/** 날짜별 매칭 통계 응답 */
export interface DailyMatchingStatsResponse {
    stats: DailyMatchingStats[];
}

/** AI 추천 이력 단건 */
export interface AIRecommendHistoryRead {
    id: string;
    target_user_id: string;
    /** { candidate_id: { score: number; reason: string } } */
    candidate_results: Record<string, { score: number; reason: string }>;
    created_at: string;
    target_user_name?: string;
}
