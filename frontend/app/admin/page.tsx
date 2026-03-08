"use client";

import React, { useState, useEffect, useCallback } from "react";
import { adminAuth, listUsers, updateUser, deleteUser, createMatching, listMatchings, updateMatchingStatus, setAdminToken, getAIRecommendations, deleteMatching } from "@/lib/api";
import type { UserReadAdmin, MatchingResponse, MatchStatus, AIRecommendResult } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

// ─────────────────────────────────────────────
// 성별 · 흡연 레이블 변환
// ─────────────────────────────────────────────
const GENDER_LABEL: Record<string, string> = { MALE: "남", FEMALE: "여" };
const SMOKING_LABEL: Record<string, string> = { SMOKER: "흡연", NON_SMOKER: "비흡연" };
const DRINKING_LABEL: Record<string, string> = { NON_DRINKER: "비음주", SOCIAL_DRINKER: "가끔 (회식 등)", DRINKER: "음주" };
const AGE_PREF_LABEL: Record<string, string> = { OLDER: "연상", YOUNGER: "연하", SAME: "동갑", ANY: "상관없음" };

// ─────────────────────────────────────────────
// 유저 상세 다이얼로그
// ─────────────────────────────────────────────
function UserDetailDialog({
    user,
    onClose,
}: {
    user: UserReadAdmin | null;
    onClose: () => void;
}) {
    if (!user) return null;

    const rows: [string, React.ReactNode][] = [
        ["이름", user.name],
        ["성별", GENDER_LABEL[user.gender] ?? user.gender],
        ["출생연도", user.birth_year],
        ["직업", user.job],
        ["연락처", user.contact],
        ["소개한 지인", user.referrer_name],
        ["활동지역", user.active_area || "-"],
        ["키", user.height ? `${user.height}cm` : "-"],
        ["학력", user.education || "-"],
        ["직장위치", user.workplace || "-"],
        ["MBTI", user.mbti || "-"],
        ["종교", user.religion || "-"],
        ["흡연", user.smoking_status ? SMOKING_LABEL[user.smoking_status] : "-"],
        ["음주", user.drinking_status ? DRINKING_LABEL[user.drinking_status] : "-"],
        ["운동", user.exercise || "-"],
        ["취미", user.hobbies || "-"],
        ["선호 연령", user.age_preference?.length ? user.age_preference.map(p => AGE_PREF_LABEL[p] || p).join(", ") : "-"],
        ["연상 나이차", user.age_gap_older ? `최대 ${user.age_gap_older}살` : "-"],
        ["연하 나이차", user.age_gap_younger ? `최대 ${user.age_gap_younger}살` : "-"],
        ["원하는 조건", user.desired_conditions],
        ["기피 조건", user.deal_breakers],
        ["자기소개", user.intro || "-"],
        [
            "인스타그램",
            user.instagram_id ? (
                <a
                    href={`https://instagram.com/${user.instagram_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                >
                    @{user.instagram_id}
                </a>
            ) : (
                "-"
            ),
        ],
    ];

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent
                className="max-w-md max-h-[80vh] overflow-y-auto"
                aria-describedby={undefined}
            >
                <DialogHeader>
                    <DialogTitle className="text-slate-900">
                        {user.name}{" "}
                        <span className="text-slate-400 text-sm font-normal">({user.id.slice(0, 8)}…)</span>
                    </DialogTitle>
                </DialogHeader>
                <dl className="space-y-3 py-2">
                    {rows.map(([label, value]) => (
                        <div key={label} className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
                            <dt className="text-slate-500 font-medium shrink-0">{label}</dt>
                            <dd className="text-slate-900 break-words">{value ?? "-"}</dd>
                        </div>
                    ))}
                </dl>

                {/* 사진 갤러리 */}
                {user.photo_urls && user.photo_urls.length > 0 && (
                    <div className="space-y-2 py-2">
                        <p className="text-slate-500 font-medium text-sm">
                            프로필 사진 ({user.photo_urls.length}장)
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {user.photo_urls.map((url, idx) => (
                                <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={url}
                                        alt={`${user.name} 사진 ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    {idx === 0 && (
                                        <span className="absolute bottom-1 left-1 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">
                                            대표
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                    <Button variant="outline" className="w-full" onClick={onClose}>
                        닫기
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────
// 유저 카드 컴포넌트
// ─────────────────────────────────────────────
function UserCard({
    user,
    selectedUserIds,
    onSelect,
    onDetail,
    onToggleActive,
    onDelete,
}: {
    user: UserReadAdmin;
    selectedUserIds: string[];
    onSelect: (user: UserReadAdmin) => void;
    onDetail: () => void;
    onToggleActive: (user: UserReadAdmin) => void;
    onDelete: () => void;
}) {
    const cardBgClass = user.gender === "MALE"
        ? "bg-blue-50/20 hover:bg-blue-50/60 border-blue-100"
        : "bg-pink-50/20 hover:bg-pink-50/60 border-pink-100";

    const cardBorderClass = user.gender === "MALE"
        ? "hover:border-blue-400"
        : "hover:border-pink-400";

    return (
        <Card
            className={`shadow-sm transition-opacity cursor-pointer ${cardBgClass} ${cardBorderClass} ${user.is_active ? "" : "opacity-50"}`}
            onClick={onDetail}
        >
            <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                    {/* 체크박스 (매칭용) */}
                    <div className="shrink-0 flex items-center justify-center p-1" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 focus:ring-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            checked={selectedUserIds.includes(user.id)}
                            onChange={() => onSelect(user)}
                            disabled={!user.is_active}
                        />
                    </div>

                    {/* 아바타 */}
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                        {user.gender === "MALE" ? "👨" : "👩"}
                    </div>

                    {/* 기본 정보 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-900 font-semibold text-sm truncate">
                                {user.name}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                                {user.birth_year % 100}년생
                            </span>
                        </div>
                        <p className="text-slate-500 text-[10px] truncate mt-0.5">
                            {user.job}
                        </p>
                    </div>

                    {/* 액션 */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* 활성 토글 */}
                        <div
                            className="flex flex-col items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Switch
                                checked={user.is_active}
                                onCheckedChange={() => onToggleActive(user)}
                                className="scale-75 data-[state=checked]:bg-blue-600"
                            />
                            <span className="text-[8px] text-slate-400">
                                {user.is_active ? "활성" : "비활성"}
                            </span>
                        </div>

                        {/* 삭제 */}
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-600 transition-colors"
                        >
                            <span className="text-xl">×</span>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function AdminPage() {
    const [authed, setAuthed] = useState(false);
    const [pw, setPw] = useState("");
    const [authError, setAuthError] = useState("");
    const [authLoading, setAuthLoading] = useState(false);

    const [users, setUsers] = useState<UserReadAdmin[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [filterGender, setFilterGender] = useState<"" | "MALE" | "FEMALE">("");
    const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
    const [selectedUser, setSelectedUser] = useState<UserReadAdmin | null>(null);
    const [toDeleteId, setToDeleteId] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<"USERS" | "MATCHINGS">("USERS");
    const [matchings, setMatchings] = useState<MatchingResponse[]>([]);
    const [loadingMatchings, setLoadingMatchings] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [creatingMatch, setCreatingMatch] = useState(false);
    const [filterMatchStatus, setFilterMatchStatus] = useState<"" | MatchStatus>("");

    // AI 매칭 관련 상태
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResults, setAiResults] = useState<AIRecommendResult[]>([]);
    const [aiTargetUserId, setAiTargetUserId] = useState<string | null>(null);

    // ── 유저 목록 fetch ──────────────────────
    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const data = await listUsers({});
            setUsers(data);
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    const fetchMatchings = useCallback(async () => {
        setLoadingMatchings(true);
        try {
            const data = await listMatchings(filterMatchStatus || undefined);
            setMatchings(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingMatchings(false);
        }
    }, [filterMatchStatus]);

    useEffect(() => {
        if (authed) {
            fetchUsers();
            fetchMatchings();
        }
    }, [authed, fetchUsers, fetchMatchings]);

    // ── 관리자 로그인 ────────────────────────
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError("");
        try {
            const res = await adminAuth(pw);
            setAdminToken(res.access_token);
            setAuthed(true);
        } catch (err) {
            setAuthError(err instanceof Error ? err.message : "인증 실패");
        } finally {
            setAuthLoading(false);
        }
    };

    // ── is_active 토글 ───────────────────────
    const handleToggleActive = async (user: UserReadAdmin) => {
        try {
            const updated = await updateUser(user.id, { is_active: !user.is_active });
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        } catch (err) {
            alert(err instanceof Error ? err.message : "업데이트 실패");
        }
    };

    // ── 유저 삭제 ────────────────────────────
    const handleDelete = async () => {
        if (!toDeleteId) return;
        setDeleteLoading(true);
        try {
            await deleteUser(toDeleteId);
            setUsers((prev) => prev.filter((u) => u.id !== toDeleteId));
            setToDeleteId(null);
        } catch (err) {
            alert(err instanceof Error ? err.message : "삭제 실패");
        } finally {
            setDeleteLoading(false);
        }
    };

    // ── 매칭 관련 함수 ───────────────────────
    const handleSelectUser = (user: UserReadAdmin) => {
        if (!user.is_active) {
            alert("비활성 유저는 매칭할 수 없습니다.");
            return;
        }

        setSelectedUserIds((prev) => {
            if (prev.includes(user.id)) return prev.filter((id) => id !== user.id);
            return [...prev, user.id];
        });
    };

    const checkSelectionMode = () => {
        if (selectedUserIds.length < 2) return { canMatch: false, canAi: false, msg: "" };

        const selectedUsers = users.filter((u) => selectedUserIds.includes(u.id));
        const males = selectedUsers.filter((u) => u.gender === "MALE");
        const females = selectedUsers.filter((u) => u.gender === "FEMALE");

        if (males.length === 1 && females.length === 1) {
            return { canMatch: true, canAi: true, msg: "1:1 매칭 또는 AI 추천" };
        }
        if ((males.length === 1 && females.length > 1) || (females.length === 1 && males.length > 1)) {
            return { canMatch: false, canAi: true, msg: `1:N AI 추천 대기` };
        }
        return { canMatch: false, canAi: false, msg: "오직 1:1 이거나 1:N 이성만 선택해야 합니다." };
    };

    const handleCreateMatch = async () => {
        const { canMatch } = checkSelectionMode();
        if (!canMatch) {
            alert("일반 매칭은 남성 1명과 여성 1명만 선택할 수 있습니다.");
            return;
        }

        setCreatingMatch(true);
        try {
            await createMatching({ user_a_id: selectedUserIds[0], user_b_id: selectedUserIds[1] });
            alert("매칭이 생성되었습니다.");
            setSelectedUserIds([]);
            setActiveTab("MATCHINGS");
            fetchMatchings();
        } catch (err) {
            alert(err instanceof Error ? err.message : "매칭 생성 실패");
        } finally {
            setCreatingMatch(false);
        }
    };

    const handleGetAiRecommendations = async () => {
        const { canAi } = checkSelectionMode();
        if (!canAi) return;

        const selectedUsers = users.filter((u) => selectedUserIds.includes(u.id));
        const males = selectedUsers.filter((u) => u.gender === "MALE");
        const females = selectedUsers.filter((u) => u.gender === "FEMALE");

        let targetUserId = "";
        let candidateIds: string[] = [];

        if (males.length === 1) {
            targetUserId = males[0].id;
            candidateIds = females.map(u => u.id);
        } else {
            targetUserId = females[0].id;
            candidateIds = males.map(u => u.id);
        }

        setAiTargetUserId(targetUserId);
        setShowAiModal(true);
        setAiLoading(true);
        setAiResults([]);

        try {
            const results = await getAIRecommendations({
                target_user_id: targetUserId,
                candidate_user_ids: candidateIds
            });
            setAiResults(results);
        } catch (err) {
            alert(err instanceof Error ? err.message : "AI 추천 처리 중 오류가 발생했습니다.");
            setShowAiModal(false);
        } finally {
            setAiLoading(false);
        }
    };

    const handleCreateAIMatch = async (candidateId: string, score: number, reason: string) => {
        if (!aiTargetUserId) return;
        setCreatingMatch(true);
        try {
            await createMatching({
                user_a_id: aiTargetUserId,
                user_b_id: candidateId,
                ai_score: score,
                ai_reason: reason
            });
            alert("AI 추천 결과가 반영된 매칭이 생성되었습니다.");
            setShowAiModal(false);
            setSelectedUserIds([]);
            setActiveTab("MATCHINGS");
            fetchMatchings();
        } catch (err) {
            alert(err instanceof Error ? err.message : "매칭 생성 실패");
        } finally {
            setCreatingMatch(false);
        }
    };

    const handleUpdateMatchStatus = async (matchingId: string, userId: string, status: MatchStatus) => {
        try {
            await updateMatchingStatus(matchingId, { user_id: userId, status });
            // local update
            setMatchings(prev => prev.map(m => {
                if (m.id === matchingId) {
                    if (m.user_a_id === userId) return { ...m, user_a_status: status };
                    if (m.user_b_id === userId) return { ...m, user_b_status: status };
                }
                return m;
            }));
        } catch (err) {
            alert(err instanceof Error ? err.message : "상태 업데이트 실패");
        }
    };

    const handleDeleteMatching = async (matchingId: string) => {
        if (!confirm("정말 이 매칭을 삭제하시겠습니까?")) return;
        try {
            await deleteMatching(matchingId);
            setMatchings(prev => prev.filter(m => m.id !== matchingId));
            alert("매칭이 삭제되었습니다.");
        } catch (err) {
            alert(err instanceof Error ? err.message : "매칭 삭제 실패");
        }
    };

    // ─────────────────────────────────────────
    // 로그인 화면
    // ─────────────────────────────────────────
    if (!authed) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <Card className="w-full max-w-sm shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-900 text-xl">🔐 관리자 로그인</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-slate-900 font-semibold text-sm">
                                    관리자 비밀번호
                                </Label>
                                <Input
                                    id="admin-pw"
                                    type="password"
                                    placeholder="비밀번호 입력"
                                    value={pw}
                                    onChange={(e) => setPw(e.target.value)}
                                    required
                                />
                            </div>
                            {authError && (
                                <p className="text-red-500 text-sm">{authError}</p>
                            )}
                            <Button
                                type="submit"
                                disabled={authLoading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                            >
                                {authLoading ? "확인 중..." : "로그인"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>
        );
    }

    // ─────────────────────────────────────────
    // 관리자 대시보드
    // ─────────────────────────────────────────
    const activeUsers = users.filter((u: UserReadAdmin) => u.is_active);
    const activeCount = activeUsers.length;
    const maleCount = activeUsers.filter((u: UserReadAdmin) => u.gender === "MALE").length;
    const femaleCount = activeUsers.filter((u: UserReadAdmin) => u.gender === "FEMALE").length;

    // 프론트엔드 단에서 리스트 필터링 수행
    const filteredUsers = users.filter((u: UserReadAdmin) => {
        if (filterGender && u.gender !== filterGender) return false;
        if (filterActive === "true" && !u.is_active) return false;
        if (filterActive === "false" && u.is_active) return false;
        return true;
    });

    return (
        <main className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-slate-900 font-bold text-2xl tracking-tight">
                            TwoDegrees 관리자 💑
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">가입자 목록 및 매칭 풀 관리</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-slate-500"
                        onClick={() => setAuthed(false)}
                    >
                        로그아웃
                    </Button>
                </div>

                {/* 탭 네비게이션 */}
                <div className="flex gap-4 border-b border-slate-200 pb-2">
                    <button
                        className={`font-semibold pb-2 border-b-2 transition-colors ${activeTab === "USERS" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                        onClick={() => setActiveTab("USERS")}
                    >
                        가입자 목록
                    </button>
                    <button
                        className={`font-semibold pb-2 border-b-2 transition-colors ${activeTab === "MATCHINGS" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                        onClick={() => setActiveTab("MATCHINGS")}
                    >
                        매칭 관리 ({matchings.length})
                    </button>
                </div>

                {/* --- 유저 탭 --- */}
                {activeTab === "USERS" && (
                    <div className="space-y-6">
                        {/* 통계 카드 */}
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: "전체", value: users.length, color: "text-slate-900" },
                                { label: "매칭 활성", value: activeCount, color: "text-blue-600" },
                                { label: "활성 (남 / 여)", value: `${maleCount} / ${femaleCount}`, color: "text-slate-700" },
                            ].map(({ label, value, color }) => (
                                <Card key={label} className="shadow-sm">
                                    <CardContent className="pt-4 pb-4 text-center">
                                        <p className={`text-2xl font-bold ${color}`}>{value}</p>
                                        <p className="text-slate-500 text-xs mt-1">{label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* 필터 및 매칭 생성 액션 */}
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex flex-wrap gap-3 items-center">
                                <select
                                    value={filterGender}
                                    onChange={(e) => setFilterGender(e.target.value as typeof filterGender)}
                                    className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">성별: 전체</option>
                                    <option value="MALE">남성</option>
                                    <option value="FEMALE">여성</option>
                                </select>
                                <select
                                    value={filterActive}
                                    onChange={(e) => setFilterActive(e.target.value as typeof filterActive)}
                                    className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">활성: 전체</option>
                                    <option value="true">활성</option>
                                    <option value="false">비활성</option>
                                </select>
                                <Button size="sm" variant="outline" onClick={fetchUsers} disabled={loadingUsers}>
                                    {loadingUsers ? "로딩 중..." : "새로고침"}
                                </Button>
                                <span className="text-slate-400 text-sm">{filteredUsers.length}명</span>
                            </div>

                            {selectedUserIds.length > 0 && (
                                <div className="flex items-center gap-3 bg-blue-50 pl-4 py-1 pr-1 rounded-full border border-blue-100">
                                    <span className="text-sm font-medium text-blue-700">{selectedUserIds.length}명 선택됨 {checkSelectionMode().msg ? `(${checkSelectionMode().msg})` : ""}</span>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-8 px-4"
                                            disabled={!checkSelectionMode().canAi || creatingMatch}
                                            onClick={handleGetAiRecommendations}
                                        >
                                            ✨ AI 추천 받기
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full h-8 px-4"
                                            disabled={!checkSelectionMode().canMatch || creatingMatch}
                                            onClick={handleCreateMatch}
                                        >
                                            {creatingMatch ? "생성 중..." : "일반 매칭 만들기"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 유저 목록 */}
                        {filteredUsers.length === 0 && !loadingUsers ? (
                            <p className="text-center text-slate-400 py-16">가입자가 없습니다.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* 남성 목록 */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                                        <h3 className="text-blue-700 font-bold flex items-center gap-2">
                                            <span>👨 남성</span>
                                            <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full">{filteredUsers.filter(u => u.gender === "MALE").length}</span>
                                        </h3>
                                    </div>
                                    <div className="space-y-3">
                                        {filteredUsers.filter(u => u.gender === "MALE").map((user) => (
                                            <UserCard
                                                key={user.id}
                                                user={user}
                                                selectedUserIds={selectedUserIds}
                                                onSelect={handleSelectUser}
                                                onDetail={() => setSelectedUser(user)}
                                                onToggleActive={handleToggleActive}
                                                onDelete={() => setToDeleteId(user.id)}
                                            />
                                        ))}
                                        {filteredUsers.filter(u => u.gender === "MALE").length === 0 && (
                                            <p className="text-center text-slate-300 py-8 text-sm italic">해당하는 남성이 없습니다.</p>
                                        )}
                                    </div>
                                </div>

                                {/* 여성 목록 */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-pink-100 pb-2">
                                        <h3 className="text-pink-700 font-bold flex items-center gap-2">
                                            <span>👩 여성</span>
                                            <span className="text-xs bg-pink-100 px-2 py-0.5 rounded-full">{filteredUsers.filter(u => u.gender === "FEMALE").length}</span>
                                        </h3>
                                    </div>
                                    <div className="space-y-3">
                                        {filteredUsers.filter(u => u.gender === "FEMALE").map((user) => (
                                            <UserCard
                                                key={user.id}
                                                user={user}
                                                selectedUserIds={selectedUserIds}
                                                onSelect={handleSelectUser}
                                                onDetail={() => setSelectedUser(user)}
                                                onToggleActive={handleToggleActive}
                                                onDelete={() => setToDeleteId(user.id)}
                                            />
                                        ))}
                                        {filteredUsers.filter(u => u.gender === "FEMALE").length === 0 && (
                                            <p className="text-center text-slate-300 py-8 text-sm italic">해당하는 여성이 없습니다.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- 매칭 탭 --- */}
                {activeTab === "MATCHINGS" && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-3 items-center">
                            <select
                                value={filterMatchStatus}
                                onChange={(e) => setFilterMatchStatus(e.target.value as MatchStatus | "")}
                                className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">상태: 전체</option>
                                <option value="PENDING">대기 중 (PENDING)</option>
                                <option value="ACCEPTED">수락됨 (ACCEPTED)</option>
                                <option value="REJECTED">거절됨 (REJECTED)</option>
                            </select>
                            <Button size="sm" variant="outline" onClick={fetchMatchings} disabled={loadingMatchings}>
                                {loadingMatchings ? "로딩 중..." : "새로고침"}
                            </Button>
                        </div>

                        {matchings.length === 0 && !loadingMatchings ? (
                            <p className="text-center text-slate-400 py-16">등록된 매칭이 없습니다.</p>
                        ) : (
                            <div className="space-y-4">
                                {matchings.map((match) => (
                                    <Card key={match.id} className="shadow-sm border-slate-200 overflow-hidden">
                                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                            <span>생성: {new Date(match.created_at).toLocaleString()}</span>
                                            <div className="flex items-center gap-1.5">
                                                {(match.user_a_status === "ACCEPTED" && match.user_b_status === "ACCEPTED") ? (
                                                    <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">성사 완료! 🎉</span>
                                                ) : (match.user_a_status === "REJECTED" || match.user_b_status === "REJECTED") ? (
                                                    <span className="font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">매칭 실패</span>
                                                ) : (
                                                    <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">진행 중 ⏳</span>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors rounded-full"
                                                    onClick={() => handleDeleteMatching(match.id)}
                                                >
                                                    <span className="text-xl font-medium leading-none">×</span>
                                                </Button>
                                            </div>
                                        </div>
                                        <CardContent className="p-0">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                                                {/* User A */}
                                                <div className={`p-4 flex flex-col gap-3 transition-colors ${match.user_a_info.gender === "MALE" ? "bg-blue-50/20" : "bg-pink-50/20"}`}>
                                                    <div
                                                        className="flex items-center gap-3 cursor-pointer group"
                                                        onClick={() => setSelectedUser(match.user_a_info)}
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0 group-hover:bg-blue-100 transition-colors">
                                                            {match.user_a_info.gender === "MALE" ? "👨" : "👩"}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{match.user_a_info.name}</p>
                                                                <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1">{match.user_a_info.birth_year}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 truncate mt-0.5">{match.user_a_info.contact}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-auto">
                                                        <span className={`text-xs font-bold ${match.user_a_status === "ACCEPTED" ? "text-green-600" :
                                                            match.user_a_status === "REJECTED" ? "text-red-600" : "text-slate-500"
                                                            }`}>
                                                            {match.user_a_status}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            <Button size="sm" variant={match.user_a_status === "ACCEPTED" ? "default" : "outline"} className={`h-7 px-2.5 text-xs shadow-none ${match.user_a_status === "ACCEPTED" ? "bg-green-600 hover:bg-green-700" : ""}`} onClick={() => handleUpdateMatchStatus(match.id, match.user_a_id, "ACCEPTED")}>수락</Button>
                                                            <Button size="sm" variant={match.user_a_status === "REJECTED" ? "default" : "outline"} className={`h-7 px-2.5 text-xs shadow-none ${match.user_a_status === "REJECTED" ? "bg-red-500 hover:bg-red-600" : ""}`} onClick={() => handleUpdateMatchStatus(match.id, match.user_a_id, "REJECTED")}>거절</Button>
                                                            <Button size="sm" variant={match.user_a_status === "PENDING" ? "default" : "outline"} className={`h-7 px-2.5 text-xs shadow-none ${match.user_a_status === "PENDING" ? "bg-slate-500 hover:bg-slate-600" : ""}`} onClick={() => handleUpdateMatchStatus(match.id, match.user_a_id, "PENDING")}>대기</Button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* User B */}
                                                <div className={`p-4 flex flex-col gap-3 transition-colors ${match.user_b_info.gender === "MALE" ? "bg-blue-50/20" : "bg-pink-50/20"}`}>
                                                    <div
                                                        className="flex items-center gap-3 cursor-pointer group"
                                                        onClick={() => setSelectedUser(match.user_b_info)}
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center text-lg shrink-0 group-hover:bg-pink-100 transition-colors">
                                                            {match.user_b_info.gender === "MALE" ? "👨" : "👩"}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold text-slate-900 truncate group-hover:text-pink-600 transition-colors">{match.user_b_info.name}</p>
                                                                <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1">{match.user_b_info.birth_year}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 truncate mt-0.5">{match.user_b_info.contact}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-auto">
                                                        <span className={`text-xs font-bold ${match.user_b_status === "ACCEPTED" ? "text-green-600" :
                                                            match.user_b_status === "REJECTED" ? "text-red-600" : "text-slate-500"
                                                            }`}>
                                                            {match.user_b_status}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            <Button size="sm" variant={match.user_b_status === "ACCEPTED" ? "default" : "outline"} className={`h-7 px-2.5 text-xs shadow-none ${match.user_b_status === "ACCEPTED" ? "bg-green-600 hover:bg-green-700" : ""}`} onClick={() => handleUpdateMatchStatus(match.id, match.user_b_id, "ACCEPTED")}>수락</Button>
                                                            <Button size="sm" variant={match.user_b_status === "REJECTED" ? "default" : "outline"} className={`h-7 px-2.5 text-xs shadow-none ${match.user_b_status === "REJECTED" ? "bg-red-500 hover:bg-red-600" : ""}`} onClick={() => handleUpdateMatchStatus(match.id, match.user_b_id, "REJECTED")}>거절</Button>
                                                            <Button size="sm" variant={match.user_b_status === "PENDING" ? "default" : "outline"} className={`h-7 px-2.5 text-xs shadow-none ${match.user_b_status === "PENDING" ? "bg-slate-500 hover:bg-slate-600" : ""}`} onClick={() => handleUpdateMatchStatus(match.id, match.user_b_id, "PENDING")}>대기</Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 상세 다이얼로그 */}
            <UserDetailDialog
                user={selectedUser}
                onClose={() => setSelectedUser(null)}
            />

            {/* 삭제 확인 다이얼로그 */}
            {toDeleteId && (
                <Dialog open onOpenChange={() => setToDeleteId(null)}>
                    <DialogContent className="max-w-sm" aria-describedby={undefined}>
                        <DialogHeader>
                            <DialogTitle className="text-slate-900">정말 삭제할까요?</DialogTitle>
                        </DialogHeader>
                        <p className="text-slate-500 text-sm py-2">
                            이 작업은 되돌릴 수 없습니다. 해당 사용자의 모든 정보가 영구 삭제됩니다.
                        </p>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setToDeleteId(null)}>
                                취소
                            </Button>
                            <Button
                                className="bg-red-500 hover:bg-red-600 text-white"
                                disabled={deleteLoading}
                                onClick={handleDelete}
                            >
                                {deleteLoading ? "삭제 중..." : "삭제"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* AI 추천 모달 */}
            <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle className="text-slate-900 flex items-center gap-2">
                            ✨ Gemini AI 매칭 추천
                        </DialogTitle>
                    </DialogHeader>

                    {aiLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-4">
                            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-slate-600 font-medium animate-pulse">AI가 최적의 상대를 분석 중입니다...</p>
                            <p className="text-slate-400 text-sm text-center">조건을 교차 검증하고 추천 멘트를 작성하고 있어요.<br />잠시만 기다려주세요.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 pb-4">
                            {aiResults.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">추천 결과가 없습니다.</p>
                            ) : (
                                aiResults.map((result) => {
                                    const candidate = users.find(u => u.id === result.candidate_id);
                                    if (!candidate) return null;

                                    return (
                                        <Card key={result.candidate_id} className="border-indigo-100 overflow-hidden shadow-sm">
                                            <div className="bg-gradient-to-r from-indigo-50 to-white px-4 py-3 border-b border-indigo-100 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center text-sm shadow-sm">
                                                        {candidate.gender === "MALE" ? "👨" : "👩"}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900">{candidate.name} <span className="text-xs font-normal text-slate-500 ml-1">{candidate.birth_year}년생</span></h4>
                                                        <p className="text-xs text-slate-500">{candidate.job} · {candidate.contact}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs text-indigo-500 font-semibold mb-0.5">AI 적합도</span>
                                                    <div className="bg-indigo-600 text-white font-bold text-lg px-2.5 py-0.5 rounded shadow-sm">
                                                        {result.score}점
                                                    </div>
                                                </div>
                                            </div>
                                            <CardContent className="p-4 bg-white space-y-4">
                                                <div className="bg-slate-50 rounded p-3 text-sm text-slate-700 leading-relaxed border border-slate-100">
                                                    <p className="font-semibold text-slate-900 mb-1 text-xs">🤖 AI 추천 사유</p>
                                                    {result.reason}
                                                </div>
                                                <Button
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                                                    disabled={creatingMatch}
                                                    onClick={() => handleCreateAIMatch(candidate.id, result.score, result.reason)}
                                                >
                                                    {creatingMatch ? "매칭 생성 중..." : "이 사람과 매칭 확정하기"}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </main>
    );
}
