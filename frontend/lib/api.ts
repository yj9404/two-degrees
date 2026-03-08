// lib/api.ts
// 백엔드 API 호출 유틸리티

import type {
    AuthPayload,
    AuthResponse,
    UserCreatePayload,
    UserReadAdmin,
    UserUpdatePayload,
    UserStatsResponse,
    MatchStatus,
    MatchingCreatePayload,
    MatchingUpdatePayload,
    MatchingResponse,
    AIRecommendRequest,
    AIRecommendResult,
} from "@/types/user";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** 관리자 JWT 토큰 저장 (메모리상 유지) */
let adminToken: string | null = null;

/** 관리자 인증 토큰 설정 */
export function setAdminToken(token: string) {
    adminToken = token;
}

/** 관리자 인증 토큰 가져오기 */
export function getAdminToken() {
    return adminToken;
}

/** 공통 fetch 헬퍼 */
async function apiFetch<T>(
    path: string,
    options: RequestInit
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };

    if (adminToken) {
        headers["Authorization"] = `Bearer ${adminToken}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (res.status === 204) {
        return null as unknown as T;
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        let errMsg = `서버 오류 (${res.status})`;

        if (err?.detail) {
            if (Array.isArray(err.detail)) {
                // Pydantic 검증 에러 배열인 경우
                errMsg = err.detail[0]?.msg ?? errMsg;
            } else if (typeof err.detail === "string") {
                errMsg = err.detail;
            }
        }

        throw new Error(errMsg);
    }

    return res.json();
}

/** POST /api/users – 소개팅 풀 등록 */
export async function registerUser(
    payload: UserCreatePayload
): Promise<UserReadAdmin> {
    return apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/** GET /api/users/stats – 홛성화 프로필 남/녀 비율 통계 */
export async function getUserStats(): Promise<UserStatsResponse> {
    return apiFetch("/api/users/stats", {
        method: "GET",
    });
}

/** POST /api/users/auth – 본인 인증 */
export async function authenticateUser(
    payload: AuthPayload
): Promise<AuthResponse> {
    return apiFetch("/api/users/auth", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/** GET /api/users/{user_id} – 단일 유저 조회 */
export async function getUser(userId: string): Promise<UserReadAdmin> {
    return apiFetch(`/api/users/${userId}`, { method: "GET" });
}

/** PUT /api/users/{user_id} – 프로필 수정 */
export async function updateUser(
    userId: string,
    payload: UserUpdatePayload
): Promise<UserReadAdmin> {
    return apiFetch(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

/** POST /api/admin/login – 관리자 인증 */
export async function adminAuth(password: string): Promise<{ access_token: string, token_type: string }> {
    return apiFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
    });
}

/** GET /api/users – 전체 유저 목록 (관리자) */
export async function listUsers(params?: {
    gender?: string;
    is_active?: boolean;
}): Promise<UserReadAdmin[]> {
    const qs = new URLSearchParams();
    if (params?.gender) qs.set("gender", params.gender);
    if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
    const query = qs.toString() ? `?${qs}` : "";
    return apiFetch(`/api/users${query}`, { method: "GET" });
}

/** DELETE /api/users/{user_id} – 유저 삭제 (관리자) */
export async function deleteUser(userId: string): Promise<void> {
    return apiFetch(`/api/users/${userId}`, {
        method: "DELETE",
    });
}

/** GET /api/upload/presigned-url – S3 업로드용 Presigned URL 발급 */
export async function getPresignedUrl(
    filename: string,
    contentType: string
): Promise<{ presigned_url: string; object_key: string; public_url: string }> {
    const qs = new URLSearchParams({ filename, content_type: contentType });
    return apiFetch(`/api/upload/presigned-url?${qs}`, { method: "GET" });
}

/**
 * S3 Presigned URL을 사용해 브라우저에서 직접 파일을 업로드합니다.
 * 성공 시 DB에 저장할 public_url을 반환합니다.
 */
export async function uploadImageToS3(file: File): Promise<string> {
    // 1. Presigned URL 발급
    const { presigned_url, public_url } = await getPresignedUrl(
        file.name,
        file.type
    );

    // 2. 브라우저에서 S3로 직접 PUT
    const uploadRes = await fetch(presigned_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
    });

    if (!uploadRes.ok) {
        throw new Error(`S3 업로드 실패 (${uploadRes.status})`);
    }

    return public_url;
}

/** ──────────────────────────────────────────────────────────── 
 * MATCHING API 
 * ──────────────────────────────────────────────────────────── */

/** POST /api/matchings – 수동 매칭 생성 (관리자) */
export async function createMatching(payload: MatchingCreatePayload): Promise<MatchingResponse> {
    return apiFetch("/api/matchings", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/** GET /api/matchings – 전체 매칭 리스트 조회 (관리자) */
export async function listMatchings(statusFilter?: MatchStatus): Promise<MatchingResponse[]> {
    const qs = statusFilter ? `?status_filter=${statusFilter}` : "";
    return apiFetch(`/api/matchings${qs}`, { method: "GET" });
}

/** PUT /api/matchings/{matching_id}/status – 매칭 상태 업데이트 (관리자) */
export async function updateMatchingStatus(
    matchingId: string,
    payload: MatchingUpdatePayload
): Promise<MatchingResponse> {
    return apiFetch(`/api/matchings/${matchingId}/status`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

/** DELETE /api/matchings/{matching_id} – 매칭 삭제 (관리자) */
export async function deleteMatching(matchingId: string): Promise<void> {
    return apiFetch(`/api/matchings/${matchingId}`, {
        method: "DELETE",
    });
}

/** POST /api/matchings/ai-recommend – AI 추천 (관리자) */
export async function getAIRecommendations(
    payload: AIRecommendRequest
): Promise<AIRecommendResult[]> {
    return apiFetch("/api/matchings/ai-recommend", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}
