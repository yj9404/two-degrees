"use client";

import { useState, useEffect, useCallback } from "react";
import { adminAuth, listUsers, updateUser, deleteUser } from "@/lib/api";
import type { UserReadAdmin } from "@/types/user";
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
    const [downloading, setDownloading] = useState(false);

    if (!user) return null;

    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

    const handleDownloadPhotos = async () => {
        if (!user.photo_urls || user.photo_urls.length === 0) return;
        setDownloading(true);
        try {
            for (let i = 0; i < user.photo_urls.length; i++) {
                const url = user.photo_urls[i];
                const name = `${user.name}_${i + 1}`;
                const proxyUrl = `${API_BASE}/api/admin/photos/proxy?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) {
                    alert(`사진 ${i + 1}번 다운로드 실패 (서버 오류 ${res.status})\n백엔드 서버를 재시작해 주세요.`);
                    break;
                }
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                // 브라우저 다운로드 차단 방지를 위한 짧은 딜레이
                if (i < user.photo_urls.length - 1) {
                    await new Promise((r) => setTimeout(r, 400));
                }
            }
        } finally {
            setDownloading(false);
        }
    };

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
                    {user.photo_urls && user.photo_urls.length > 0 && (
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                            disabled={downloading}
                            onClick={handleDownloadPhotos}
                        >
                            {downloading
                                ? "다운로드 중..."
                                : `📥 사진 전체 다운로드 (${user.photo_urls.length}장)`}
                        </Button>
                    )}
                    <Button variant="outline" className="w-full" onClick={onClose}>
                        닫기
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
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

    // ── 유저 목록 fetch ──────────────────────
    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const params: Parameters<typeof listUsers>[0] = {};
            if (filterGender) params.gender = filterGender;
            if (filterActive !== "") params.is_active = filterActive === "true";
            const data = await listUsers(params);
            setUsers(data);
        } finally {
            setLoadingUsers(false);
        }
    }, [filterGender, filterActive]);

    useEffect(() => {
        if (authed) fetchUsers();
    }, [authed, fetchUsers]);

    // ── 관리자 로그인 ────────────────────────
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError("");
        try {
            await adminAuth(pw);
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
    const activeUsers = users.filter((u) => u.is_active);
    const activeCount = activeUsers.length;
    const maleCount = activeUsers.filter((u) => u.gender === "MALE").length;
    const femaleCount = activeUsers.filter((u) => u.gender === "FEMALE").length;

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

                {/* 필터 */}
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
                    <span className="text-slate-400 text-sm ml-auto">{users.length}명</span>
                </div>

                {/* 유저 목록 */}
                {users.length === 0 && !loadingUsers ? (
                    <p className="text-center text-slate-400 py-16">가입자가 없습니다.</p>
                ) : (
                    <div className="space-y-3">
                        {users.map((user) => (
                            <Card
                                key={user.id}
                                className={`shadow-sm transition-opacity cursor-pointer hover:border-blue-300 hover:bg-slate-50 ${user.is_active ? "" : "opacity-50"}`}
                                onClick={() => setSelectedUser(user)}
                            >
                                <CardContent className="pt-4 pb-4">
                                    <div className="flex items-center gap-4">
                                        {/* 아바타 */}
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                                            {user.gender === "MALE" ? "👨" : "👩"}
                                        </div>

                                        {/* 기본 정보 */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-slate-900 font-semibold text-sm">
                                                    {user.name}
                                                </span>
                                                <span className="text-slate-400 text-xs">
                                                    {GENDER_LABEL[user.gender]} · {user.birth_year}년생
                                                </span>
                                                <span className="text-slate-400 text-xs truncate">
                                                    {user.contact}
                                                </span>
                                            </div>
                                            <p className="text-slate-500 text-xs mt-0.5 truncate">
                                                {user.job}
                                                {user.active_area ? ` · ${user.active_area}` : ""}
                                                {user.referrer_name ? ` · 추천: ${user.referrer_name}` : ""}
                                            </p>
                                        </div>

                                        {/* 액션 */}
                                        <div className="flex items-center gap-3 shrink-0">
                                            {/* 활성 토글 */}
                                            <div
                                                className="flex flex-col items-center gap-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Switch
                                                    checked={user.is_active}
                                                    onCheckedChange={() => handleToggleActive(user)}
                                                    className="data-[state=checked]:bg-blue-600"
                                                />
                                                <span className="text-[10px] text-slate-400">
                                                    {user.is_active ? "활성" : "비활성"}
                                                </span>
                                            </div>

                                            {/* 상세보기 */}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedUser(user);
                                                }}
                                                className="text-xs"
                                            >
                                                상세
                                            </Button>

                                            {/* 삭제 */}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setToDeleteId(user.id);
                                                }}
                                                className="text-xs text-red-500 border-red-200 hover:bg-red-50"
                                            >
                                                삭제
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
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
        </main>
    );
}
