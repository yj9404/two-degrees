"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { adminAuth, listUsers, updateUser, deleteUser, createMatching, listMatchings, updateMatchingStatus, setAdminToken, getAdminToken, initAdminTokenFromCookie, getAIRecommendations, getAIRecommendHistory, getAIBatchRecommendations, deleteMatching, markMatchingContactShared, refreshMatchingExpiry, listNotices, createNotice, deleteNotice, updateNotice } from "@/lib/api";
import AdvancedFilterPanel, { type AdvancedFilterValues } from "@/components/AdvancedFilterPanel";
import { CheckCircle2, XCircle, Clock, Copy, ExternalLink, MessageSquare, Sparkles, User as UserIcon, X, ChevronLeft, ChevronRight, Download, Megaphone, Trash2, Edit2, History, Zap } from "lucide-react";
import type { UserReadAdmin, MatchingResponse, MatchStatus, AIRecommendResult, AIRecommendHistoryRead, AIBatchRecommendResultItem, Notice } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
const MARRIAGE_INTENT_LABEL: Record<string, string> = {
    UNKNOWN: "미등록",
    WILLING: "생각 있음",
    OPEN: "좋은 분 나타나면",
    NOT_NOW: "아직 생각 없음",
    NON_MARRIAGE: "비혼"
};
const CHILD_PLAN_LABEL: Record<string, string> = {
    UNKNOWN: "미등록",
    WANT: "반드시 원함",
    OPEN: "좋은 분 나타나면",
    NOT_NOW: "아직 생각 없음",
    DINK: "원치 않음"
};

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
    const [zoomedPhotoIndex, setZoomedPhotoIndex] = useState<number | null>(null);

    useEffect(() => {
        setZoomedPhotoIndex(null);
    }, [user?.id]);

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
        ["결혼생각", user.marriage_intent ? MARRIAGE_INTENT_LABEL[user.marriage_intent] : "-"],
        ["아이생각", user.child_plan ? CHILD_PLAN_LABEL[user.child_plan] : "-"],
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
        <>
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
                                    <div
                                        key={url}
                                        className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 cursor-pointer group"
                                        onClick={() => setZoomedPhotoIndex(idx)}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={url}
                                            alt={`${user.name} 사진 ${idx + 1}`}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        {idx === 0 && (
                                            <span className="absolute bottom-1 left-1 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded z-10">
                                                대표
                                            </span>
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
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

            {/* 확대된 사진 다이얼로그 */}
            {zoomedPhotoIndex !== null && user.photo_urls && (
                <Dialog open={true} onOpenChange={(open: boolean) => { if (!open) setZoomedPhotoIndex(null); }}>
                    <DialogContent
                        className="max-w-3xl bg-slate-900 border-none shadow-lg p-6 flex flex-col items-center [&>button]:text-white/70 [&>button:hover]:text-white"
                        aria-describedby={undefined}
                    >
                        <DialogTitle className="sr-only">사진 확대</DialogTitle>

                        <div className="w-full text-center text-white/50 font-medium text-sm tracking-widest mb-4">
                            {zoomedPhotoIndex + 1} / {user.photo_urls.length}
                        </div>

                        <div className="relative w-full flex items-center justify-center bg-black/50 rounded-lg overflow-hidden p-2 min-h-[50vh]">
                            {/* 확대된 이미지 */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={user.photo_urls[zoomedPhotoIndex]}
                                alt="확대 이미지"
                                className="max-w-full max-h-[60vh] object-contain rounded-md select-none"
                            />

                            {/* 좌우 이동 버튼 */}
                            {user.photo_urls.length > 1 && (
                                <>
                                    <button
                                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors z-50 focus:outline-none"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setZoomedPhotoIndex(zoomedPhotoIndex === 0 ? user.photo_urls!.length - 1 : zoomedPhotoIndex - 1);
                                        }}
                                    >
                                        <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
                                    </button>
                                    <button
                                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors z-50 focus:outline-none"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setZoomedPhotoIndex(zoomedPhotoIndex === user.photo_urls!.length - 1 ? 0 : zoomedPhotoIndex + 1);
                                        }}
                                    >
                                        <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
                                    </button>
                                </>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

// ─────────────────────────────────────────────
// 매칭 상세 다이얼로그
// ─────────────────────────────────────────────
function MatchingDetailDialog({
    matching,
    onClose,
    onUpdate,
}: {
    matching: MatchingResponse | null;
    onClose: () => void;
    onUpdate: (updated: MatchingResponse) => void;
}) {
    if (!matching) return null;

    const isSuccess = matching.user_a_status === "ACCEPTED" && matching.user_b_status === "ACCEPTED";
    const isFailed = matching.user_a_status === "REJECTED" || matching.user_b_status === "REJECTED";
    const isPending = !isSuccess && !isFailed;

    // 만료 여부 체크 (프론트엔드 기준)
    const isExpired = matching.expires_at ? new Date(matching.expires_at) < new Date() : false;

    const [updatingContact, setUpdatingContact] = useState(false);

    const handleCopyAndRefresh = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            const wasNotSet = !matching.expires_at;
            const updated = await refreshMatchingExpiry(matching.id);
            onUpdate(updated);

            if (wasNotSet && updated.expires_at) {
                alert(`${label} 메시지가 복사되었습니다.\n지금부터 24시간 동안 링크가 유효합니다.`);
            } else {
                alert(`${label} 메시지가 복사되었습니다.`);
            }
        } catch (err) {
            alert("처리 중 에러가 발생했습니다.");
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            alert(`${label} 메시지가 복사되었습니다.`);
        } catch (err) {
            alert("복사에 실패했습니다.");
        }
    };

    const handleMarkContactShared = async () => {
        if (!matching) return;
        setUpdatingContact(true);
        try {
            const updated = await markMatchingContactShared(matching.id);
            onUpdate(updated);
            alert("연락처 전달 완료 상태로 업데이트되었습니다.");
        } catch (err) {
            alert(err instanceof Error ? err.message : "업데이트 실패");
        } finally {
            setUpdatingContact(false);
        }
    };

    const getBaseUrl = () => {
        // 배포 환경에서는 .env.local 등에 설정된 도메인을 우선 사용하고, 없으면 현재 접속 주소 사용
        const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
        if (envUrl) return envUrl.replace(/\/$/, ""); // 트레일링 슬래시 제거

        if (typeof window !== "undefined") {
            return window.location.origin;
        }
        return "";
    };

    const renderPendingUI = () => {
        const baseUrl = getBaseUrl();
        const pendingMsg = (token: string) =>
            `안녕하세요, TwoDegrees 관리자입니다. 어울리는 인연을 찾게 되어 매칭 제안을 드립니다. 아래 링크를 통해 상대방의 프로필을 확인해 주세요. (링크는 프라이버시 보호를 위해 24시간 후 만료되며 링크가 노출되지 않도록 주의해주세요.)\n🔗 ${baseUrl}/p/${token}\n* 두 분 모두 '수락'을 누르신 경우에만 연락처가 교환됩니다.`;

        return (
            <div className="space-y-4 py-2">
                <div className="flex flex-col gap-3">
                    <p className="text-sm font-semibold text-slate-700">제안 메시지 복사</p>
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            className="flex flex-col h-auto py-3 gap-1 border-blue-200 bg-blue-50/30 hover:bg-blue-50"
                            onClick={() => handleCopyAndRefresh(pendingMsg(matching.user_a_token || ""), `${matching.user_a_info.name}(A)용`)}
                        >
                            <div className="flex items-center gap-1.5 text-blue-600 font-bold mb-1">
                                <Copy className="w-3.5 h-3.5" />
                                <span>{matching.user_a_info.name} (A)</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-normal">남성용 링크 포함</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="flex flex-col h-auto py-3 gap-1 border-pink-200 bg-pink-50/30 hover:bg-pink-50"
                            onClick={() => handleCopyAndRefresh(pendingMsg(matching.user_b_token || ""), `${matching.user_b_info.name}(B)용`)}
                        >
                            <div className="flex items-center gap-1.5 text-pink-600 font-bold mb-1">
                                <Copy className="w-3.5 h-3.5" />
                                <span>{matching.user_b_info.name} (B)</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-normal">여성용 링크 포함</span>
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderFailedUI = () => {
        const failedMsg = "안녕하세요, TwoDegrees 관리자입니다. 아쉽게도 상대방이 매칭을 진행하지 않기로 결정했거나 링크 유효시간이 경과하여, 이번 매칭 건은 시스템에 의해 자동 종료되었습니다. 조만간 더 좋은 인연으로 다시 제안드리겠습니다. 다음 매칭을 기대해 주세요!";
        return (
            <div className="space-y-4 py-2">
                <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 leading-relaxed">
                        매칭이 성사되지 않았습니다. {isExpired ? "(기한 만료)" : "(거절됨)"}
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    <Button
                        variant="outline"
                        className="h-auto py-4 justify-start gap-3 border-blue-200 hover:bg-blue-50"
                        onClick={() => copyToClipboard(failedMsg, `${matching.user_a_info.name}(A)에게 보낼`)}
                    >
                        <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="text-left">
                            <p className="text-xs font-bold text-slate-900">{matching.user_a_info.name}(A)에게 전달할 메시지</p>
                            <p className="text-[10px] text-slate-500">거절/종료 안내 메시지</p>
                        </div>
                    </Button>
                    <Button
                        variant="outline"
                        className="h-auto py-4 justify-start gap-3 border-pink-200 hover:bg-pink-50"
                        onClick={() => copyToClipboard(failedMsg, `${matching.user_b_info.name}(B)에게 보낼`)}
                    >
                        <MessageSquare className="w-4 h-4 text-pink-600 shrink-0" />
                        <div className="text-left">
                            <p className="text-xs font-bold text-slate-900">{matching.user_b_info.name}(B)에게 전달할 메시지</p>
                            <p className="text-[10px] text-slate-500">거절/종료 안내 메시지</p>
                        </div>
                    </Button>
                </div>
                <div className="pt-2">
                    <Button
                        className={`w-full h-11 font-bold transition-all ${matching.is_contact_shared
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-600 hover:bg-slate-700 text-white shadow-sm"
                            }`}
                        onClick={handleMarkContactShared}
                        disabled={updatingContact || matching.is_contact_shared}
                    >
                        {matching.is_contact_shared ? (
                            <><CheckCircle2 className="w-4 h-4 mr-2" />메시지 전달 완료됨 (매칭종료)</>
                        ) : (
                            updatingContact ? "처리 중..." : "메시지 전달 완료 처리 (매칭종료)"
                        )}
                    </Button>
                </div>
            </div>
        );
    };

    const renderSuccessUI = () => {
        const successMsg = (targetName: string, targetContact: string) =>
            `🎉 축하드립니다! 두 분 모두 수락하셔서 매칭이 최종 성사되었습니다.\n👤 이름: ${targetName}\n📞 연락처: ${targetContact}\n* 두 분의 TwoDegrees 프로필은 잠시 휴식(비활성화) 처리되며, 추후 언제든지 다시 활성화하실 수 있습니다. 좋은 만남 응원합니다!`;

        return (
            <div className="space-y-4 py-2">
                <div className="p-4 bg-green-50 rounded-lg border border-green-100 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-green-700 font-medium">매칭 성공! 서로의 연락처를 전달해 주세요.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    <Button
                        variant="outline"
                        className="h-auto py-4 justify-start gap-3 border-blue-200 hover:bg-blue-50"
                        onClick={() => copyToClipboard(successMsg(matching.user_b_info.name, matching.user_b_info.contact), `${matching.user_a_info.name}(A)에게 보낼`)}
                    >
                        <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="text-left">
                            <p className="text-xs font-bold text-slate-900">{matching.user_a_info.name}(A)에게 전달할 메시지</p>
                            <p className="text-[10px] text-slate-500">상대방({matching.user_b_info.name})의 정보 포함</p>
                        </div>
                    </Button>
                    <Button
                        variant="outline"
                        className="h-auto py-4 justify-start gap-3 border-pink-200 hover:bg-pink-50"
                        onClick={() => copyToClipboard(successMsg(matching.user_a_info.name, matching.user_a_info.contact), `${matching.user_b_info.name}(B)에게 보낼`)}
                    >
                        <MessageSquare className="w-4 h-4 text-pink-600 shrink-0" />
                        <div className="text-left">
                            <p className="text-xs font-bold text-slate-900">{matching.user_b_info.name}(B)에게 전달할 메시지</p>
                            <p className="text-[10px] text-slate-500">상대방({matching.user_a_info.name})의 정보 포함</p>
                        </div>
                    </Button>
                </div>

                <div className="pt-2">
                    <Button
                        className={`w-full h-11 font-bold transition-all ${matching.is_contact_shared
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700 text-white shadow-sm"
                            }`}
                        onClick={handleMarkContactShared}
                        disabled={updatingContact || matching.is_contact_shared}
                    >
                        {matching.is_contact_shared ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                연락처 전달 완료됨 (매칭종료)
                            </>
                        ) : (
                            updatingContact ? "처리 중..." : "연락처 전달 완료 처리 (매칭종료)"
                        )}
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-md" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {isSuccess ? "🎉 매칭 성사 상세" : "매칭 상세 정보"}
                        <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {matching.id.slice(0, 8)}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-2">
                    {/* 상단 상태 요약 */}
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-center flex-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">USER A ({matching.user_a_info.gender === "MALE" ? "남" : "여"})</p>
                            <p className="text-sm font-bold text-slate-900">{matching.user_a_info.name}</p>
                            <p className={`text-[10px] font-bold mt-1 ${matching.user_a_status === "ACCEPTED" ? "text-green-600" : matching.user_a_status === "REJECTED" ? "text-red-500" : "text-amber-500"}`}>{matching.user_a_status}</p>
                        </div>
                        <div className="px-4 text-slate-300">
                            <span className="text-xl">↔</span>
                        </div>
                        <div className="text-center flex-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">USER B ({matching.user_b_info.gender === "MALE" ? "남" : "여"})</p>
                            <p className="text-sm font-bold text-slate-900">{matching.user_b_info.name}</p>
                            <p className={`text-[10px] font-bold mt-1 ${matching.user_b_status === "ACCEPTED" ? "text-green-600" : matching.user_b_status === "REJECTED" ? "text-red-500" : "text-amber-500"}`}>{matching.user_b_status}</p>
                        </div>
                    </div>

                    {/* AI 추천 통찰 */}
                    {matching.ai_reason && (
                        <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                            <p className="text-[10px] font-bold text-indigo-600 mb-1 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-indigo-400" /> AI 추천 인사이트
                            </p>
                            <p className="text-xs text-slate-700 leading-relaxed italic">"{matching.ai_reason}"</p>
                            {matching.ai_score && (
                                <p className="text-[10px] text-indigo-400 mt-1 font-medium">적합도 점수: {matching.ai_score}점</p>
                            )}
                        </div>
                    )}

                    {/* 상태별 액션 UI */}
                    <div className="border-t border-slate-100 pt-4">
                        {isSuccess ? renderSuccessUI() : (isFailed || isExpired) ? renderFailedUI() : renderPendingUI()}
                    </div>

                    {/* 공통 정보 (기한 등) */}
                    {!isSuccess && !isFailed && (
                        <div className={`flex items-center gap-2 p-2.5 rounded text-[11px] justify-center ${matching.expires_at ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-50'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {matching.expires_at ? (
                                <span>링크 만료 기한: {new Date(matching.expires_at).toLocaleString()} {isExpired && <span className="font-bold underline ml-1">(이미 만료됨)</span>}</span>
                            ) : (
                                <span>링크 유효기간이 아직 설정되지 않았습니다 (메시지 복사 시 24시간 설정)</span>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="pt-2">
                    <Button variant="outline" className="w-full" onClick={onClose}>닫기</Button>
                </DialogFooter>
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
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg shrink-0 overflow-hidden relative">
                        {user.photo_urls && user.photo_urls.length > 0 ? (
                            <img
                                src={user.photo_urls[0]}
                                alt={`${user.name} 썸네일`}
                                className="w-full h-full object-cover"
                                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                    // 이미지 로드 실패 시 이모지로 폴백
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement!.innerText = user.gender === "MALE" ? "👨" : "👩";
                                }}
                            />
                        ) : (
                            user.gender === "MALE" ? "👨" : "👩"
                        )}
                    </div>

                    {/* 기본 정보 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <p className="text-slate-900 font-bold text-sm truncate leading-tight">
                                {user.name}
                            </p>
                            <span className="text-[10px] text-slate-500 bg-black/5 px-1.5 py-0.5 rounded font-medium">
                                (매칭 {user.match_count || 0}회)
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-slate-400 text-[10px] font-medium shrink-0">
                                {user.birth_year % 100}년생
                            </span>
                            <span className="text-slate-300 text-[10px]">/</span>
                            <span className="text-slate-500 text-[10px] truncate">
                                {user.job}
                            </span>
                        </div>
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
// 프로필 비교 다이얼로그
// ─────────────────────────────────────────────
function CompareUsersDialog({
    baseUser,
    targetUser,
    onClose,
    onCreateMatch,
    creatingMatch,
}: {
    baseUser: UserReadAdmin | null;
    targetUser: UserReadAdmin | null;
    onClose: () => void;
    onCreateMatch?: () => void;
    creatingMatch?: boolean;
}) {
    const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);

    if (!baseUser || !targetUser) return null;

    const buildRows = (user: UserReadAdmin): [string, React.ReactNode][] => [
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
        ["결혼생각", user.marriage_intent ? MARRIAGE_INTENT_LABEL[user.marriage_intent] : "-"],
        ["아이생각", user.child_plan ? CHILD_PLAN_LABEL[user.child_plan] : "-"],
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
                    onClick={(e) => e.stopPropagation()}
                >
                    @{user.instagram_id}
                </a>
            ) : (
                "-"
            ),
        ],
    ];

    const rowsA = buildRows(baseUser);
    const rowsB = buildRows(targetUser);

    return (
        <>
            <Dialog open onOpenChange={onClose}>
                <DialogContent
                    className="max-w-4xl max-h-[85vh] overflow-y-auto"
                    aria-describedby={undefined}
                >
                    <DialogHeader>
                        <DialogTitle className="text-slate-900 border-b pb-2">
                            프로필 비교 (기준 vs 추천 대상)
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-6 py-2">
                        {/* User A Column */}
                        <div className="space-y-4 border-r pr-4">
                            <div className="font-bold text-lg text-blue-700 flex items-center justify-between">
                                <span>기준: {baseUser.name}</span>
                                <span className="text-sm font-normal text-slate-500 bg-blue-50 px-2 py-0.5 rounded">
                                    {baseUser.gender === "MALE" ? "남성" : "여성"}
                                </span>
                            </div>
                            {baseUser.photo_urls && baseUser.photo_urls.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {baseUser.photo_urls.map((url, idx) => (
                                        <div
                                            key={url}
                                            className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 cursor-pointer group"
                                            onClick={() => setZoomedPhotoUrl(url)}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={url}
                                                alt={`${baseUser.name} 사진 ${idx + 1}`}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            {idx === 0 && (
                                                <span className="absolute bottom-1 left-1 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded z-10">대표</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <dl className="space-y-3 pt-2">
                                {rowsA.map(([label, value], idx) => (
                                    <div key={idx} className="grid grid-cols-[6rem_1fr] gap-2 text-sm">
                                        <dt className="text-slate-500 font-medium shrink-0">{label}</dt>
                                        <dd className="text-slate-900 break-words">{value ?? "-"}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>

                        {/* User B Column */}
                        <div className="space-y-4 pl-2">
                            <div className="font-bold text-lg text-pink-700 flex items-center justify-between">
                                <span>대상: {targetUser.name}</span>
                                <span className="text-sm font-normal text-slate-500 bg-pink-50 px-2 py-0.5 rounded">
                                    {targetUser.gender === "MALE" ? "남성" : "여성"}
                                </span>
                            </div>
                            {targetUser.photo_urls && targetUser.photo_urls.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {targetUser.photo_urls.map((url, idx) => (
                                        <div
                                            key={url}
                                            className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 cursor-pointer group"
                                            onClick={() => setZoomedPhotoUrl(url)}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={url}
                                                alt={`${targetUser.name} 사진 ${idx + 1}`}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            {idx === 0 && (
                                                <span className="absolute bottom-1 left-1 text-[10px] bg-pink-600 text-white px-1.5 py-0.5 rounded z-10">대표</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <dl className="space-y-3 pt-2">
                                {rowsB.map(([label, value], idx) => (
                                    <div key={idx} className="grid grid-cols-[6rem_1fr] gap-2 text-sm">
                                        <dt className="text-slate-500 font-medium shrink-0">{label}</dt>
                                        <dd className="text-slate-900 break-words">{value ?? "-"}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    </div>

                    <div className="pt-4 border-t mt-4 flex justify-end">
                        <Button variant="outline" className="w-full" onClick={onClose}>
                            닫기
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 사진 확대 다이얼로그 */}
            {zoomedPhotoUrl && (
                <Dialog open={true} onOpenChange={(open: boolean) => { if (!open) setZoomedPhotoUrl(null); }}>
                    <DialogContent
                        className="max-w-3xl bg-slate-900 border-none shadow-lg p-6 flex flex-col items-center [&>button]:text-white/70 [&>button:hover]:text-white"
                        aria-describedby={undefined}
                    >
                        <DialogTitle className="sr-only">사진 확대</DialogTitle>
                        <div className="relative w-full flex items-center justify-center bg-black/50 rounded-lg overflow-hidden p-2 min-h-[50vh]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={zoomedPhotoUrl}
                                alt="확대 이미지"
                                className="max-w-full max-h-[60vh] object-contain rounded-md select-none"
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function AdminPage() {
    const [authed, setAuthed] = useState(false);

    // 페이지 로드 시 쿠키에서 토큰 복원
    useEffect(() => {
        initAdminTokenFromCookie();
        if (getAdminToken()) {
            setAuthed(true);
        }
    }, []);
    const [pw, setPw] = useState("");
    const [authError, setAuthError] = useState("");
    const [authLoading, setAuthLoading] = useState(false);

    const [users, setUsers] = useState<UserReadAdmin[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [filterGender, setFilterGender] = useState<"" | "MALE" | "FEMALE">("");
    const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
    const [filterSmoking, setFilterSmoking] = useState<"" | "SMOKER" | "NON_SMOKER">("");
    const [filterName, setFilterName] = useState("");
    const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterValues>({});
    const advancedFiltersRef = useRef<AdvancedFilterValues>({});
    const [selectedUser, setSelectedUser] = useState<UserReadAdmin | null>(null);
    const [toDeleteId, setToDeleteId] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<"USERS" | "MATCHINGS" | "NOTICES" | "AI_HISTORY" | "BATCH_AI">("USERS");
    const [matchings, setMatchings] = useState<MatchingResponse[]>([]);
    const [loadingMatchings, setLoadingMatchings] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [creatingMatch, setCreatingMatch] = useState(false);
    const [filterMatchStatus, setFilterMatchStatus] = useState<"" | MatchStatus>("");

    // 공지사항 관련 상태
    const [notices, setNotices] = useState<Notice[]>([]);
    const [loadingNotices, setLoadingNotices] = useState(false);
    const [newNotice, setNewNotice] = useState({ title: "", content: "", is_popup: false });
    const [creatingNotice, setCreatingNotice] = useState(false);
    const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

    // AI 매칭 관련 상태
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResults, setAiResults] = useState<AIRecommendResult[]>([]);
    const [aiTargetUserId, setAiTargetUserId] = useState<string | null>(null);
    const [compareCandidate, setCompareCandidate] = useState<UserReadAdmin | null>(null);
    const [compareBaseUser, setCompareBaseUser] = useState<UserReadAdmin | null>(null);

    // AI 이력 관련 상태
    const [aiHistory, setAiHistory] = useState<AIRecommendHistoryRead[]>([]);
    const [loadingAiHistory, setLoadingAiHistory] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState<AIRecommendHistoryRead | null>(null);

    // N:M 배치 추천 관련 상태
    const [batchTargetIds, setBatchTargetIds] = useState<string[]>([]);
    const [batchCandidateIds, setBatchCandidateIds] = useState<string[]>([]);
    const [batchTopN, setBatchTopN] = useState(3);
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchResults, setBatchResults] = useState<AIBatchRecommendResultItem[]>([]);
    const [batchError, setBatchError] = useState("");
    const [batchReasonEdits, setBatchReasonEdits] = useState<Record<number, string>>({});

    const [selectedMatching, setSelectedMatching] = useState<MatchingResponse | null>(null);

    // ── 유저 목록 fetch ──────────────────────
    // advancedFiltersRef를 사용해 stale closure 없이 항상 최신 필터를 참조
    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const { gender, ...otherFilters } = advancedFiltersRef.current;

            if (gender) {
                // 선택된 성별에만 나머지 조건 적용, 반대 성별은 조건 없이 전체 조회
                const oppositeGender = gender === "MALE" ? "FEMALE" : "MALE";
                const [filtered, unfiltered] = await Promise.all([
                    listUsers({ ...otherFilters, gender }),
                    listUsers({ gender: oppositeGender }),
                ]);
                setUsers([...filtered, ...unfiltered]);
            } else {
                const data = await listUsers({ ...advancedFiltersRef.current });
                setUsers(data);
            }
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    const handleApplyAdvancedFilters = useCallback((filters: AdvancedFilterValues) => {
        advancedFiltersRef.current = filters;
        setAdvancedFilters(filters); // activeCount 뱃지용
        fetchUsers();
    }, [fetchUsers]);

    const fetchMatchings = useCallback(async () => {
        setLoadingMatchings(true);
        try {
            const data = await listMatchings(filterMatchStatus || undefined);
            setMatchings(data);
        } catch {
            // Error handling if needed
        } finally {
            setLoadingMatchings(false);
        }
    }, [filterMatchStatus]);

    const fetchNotices = useCallback(async () => {
        setLoadingNotices(true);
        try {
            const data = await listNotices();
            setNotices(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingNotices(false);
        }
    }, []);

    const fetchAiHistory = useCallback(async () => {
        setLoadingAiHistory(true);
        try {
            const data = await getAIRecommendHistory();
            setAiHistory(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingAiHistory(false);
        }
    }, []);

    useEffect(() => {
        if (authed) {
            fetchUsers();
            fetchMatchings();
            fetchNotices();
            fetchAiHistory();
        }
    }, [authed, fetchUsers, fetchMatchings, fetchNotices, fetchAiHistory]);

    // ── 공지사항 관련 함수 ─────────────────────
    const handleCreateNotice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNotice.title || !newNotice.content) return;
        setCreatingNotice(true);
        try {
            await createNotice(newNotice);
            alert("공지사항이 등록되었습니다.");
            setNewNotice({ title: "", content: "", is_popup: false });
            fetchNotices();
        } catch (err) {
            alert(err instanceof Error ? err.message : "등록 실패");
        } finally {
            setCreatingNotice(false);
        }
    };

    const handleDeleteNotice = async (id: number) => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        try {
            await deleteNotice(id);
            fetchNotices();
        } catch (err) {
            alert(err instanceof Error ? err.message : "삭제 실패");
        }
    };

    const handleUpdateNotice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingNotice || !editingNotice.title || !editingNotice.content) return;
        setCreatingNotice(true); // Re-using creatingNotice for loading state
        try {
            await updateNotice(editingNotice.id, {
                title: editingNotice.title,
                content: editingNotice.content,
                is_popup: editingNotice.is_popup
            });
            alert("공지사항이 수정되었습니다.");
            setEditingNotice(null);
            fetchNotices();
        } catch (err) {
            alert(err instanceof Error ? err.message : "수정 실패");
        } finally {
            setCreatingNotice(false);
        }
    };

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

    const handleSelectAllMale = () => {
        const maleIds = filteredUsers.filter((u: UserReadAdmin) => u.gender === "MALE" && u.is_active).map((u: UserReadAdmin) => u.id);
        setSelectedUserIds((prev: string[]) => Array.from(new Set([...prev, ...maleIds])));
    };

    const handleSelectAllFemale = () => {
        const femaleIds = filteredUsers.filter((u: UserReadAdmin) => u.gender === "FEMALE" && u.is_active).map((u: UserReadAdmin) => u.id);
        setSelectedUserIds((prev: string[]) => Array.from(new Set([...prev, ...femaleIds])));
    };

    const handleDeselectAll = () => {
        setSelectedUserIds([]);
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

    const handleCreateMatchFromCompare = async () => {
        const baseId = compareBaseUser?.id ?? aiTargetUserId;
        if (!baseId || !compareCandidate) return;
        const historyData = selectedHistory?.candidate_results?.[compareCandidate.id];
        setCreatingMatch(true);
        try {
            await createMatching({
                user_a_id: baseId,
                user_b_id: compareCandidate.id,
                ...(historyData ? { ai_score: historyData.score, ai_reason: historyData.reason } : {}),
            });
            alert("매칭이 생성되었습니다.");
            setCompareCandidate(null);
            setCompareBaseUser(null);
            setActiveTab("MATCHINGS");
            fetchMatchings();
        } catch (err) {
            alert(err instanceof Error ? err.message : "매칭 생성 실패");
        } finally {
            setCreatingMatch(false);
        }
    };

    const handleCreateMatchFromCompare_History = async (targetId: string, candidateId: string, score: number, reason: string) => {
        setCreatingMatch(true);
        try {
            await createMatching({ user_a_id: targetId, user_b_id: candidateId, ai_score: score, ai_reason: reason });
            alert("매칭이 생성되었습니다.");
            setSelectedHistory(null);
            setActiveTab("MATCHINGS");
            fetchMatchings();
        } catch (err) {
            alert(err instanceof Error ? err.message : "매칭 생성 실패");
        } finally {
            setCreatingMatch(false);
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

    // ── N:M 배치 추천 함수 ───────────────────────
    const handleBatchToggleTarget = (userId: string) => {
        setBatchTargetIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleBatchToggleCandidate = (userId: string) => {
        setBatchCandidateIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleRunBatchRecommend = async () => {
        if (batchTargetIds.length === 0) { setBatchError("타겟 유저를 1명 이상 선택하세요."); return; }
        if (batchCandidateIds.length === 0) { setBatchError("후보 유저를 1명 이상 선택하세요."); return; }
        setBatchError("");
        setBatchLoading(true);
        setBatchResults([]);
        setBatchReasonEdits({});
        try {
            const results = await getAIBatchRecommendations({
                target_user_ids: batchTargetIds,
                candidate_user_ids: batchCandidateIds,
                top_n: batchTopN,
            });
            setBatchResults(results);
            // 초기 사유 편집본 세팅
            const edits: Record<number, string> = {};
            results.forEach(r => { edits[r.rank] = r.reason; });
            setBatchReasonEdits(edits);
        } catch (err) {
            setBatchError(err instanceof Error ? err.message : "배치 추천 중 오류가 발생했습니다.");
        } finally {
            setBatchLoading(false);
        }
    };

    const handleCreateBatchMatch = async (item: AIBatchRecommendResultItem) => {
        setCreatingMatch(true);
        try {
            await createMatching({
                user_a_id: item.target_user_id,
                user_b_id: item.candidate_user_id,
                ai_score: item.score,
                ai_reason: batchReasonEdits[item.rank] ?? item.reason,
            });
            alert(`${item.target_user.name} ↔ ${item.candidate_user.name} 매칭이 생성되었습니다.`);
            // 생성된 쌍을 결과에서 제거
            setBatchResults(prev => prev.filter(r => r.rank !== item.rank));
            fetchMatchings();
        } catch (err) {
            alert(err instanceof Error ? err.message : "매칭 생성 실패");
        } finally {
            setCreatingMatch(false);
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
        if (filterSmoking && u.smoking_status !== filterSmoking) return false;
        if (filterName && !u.name.toLowerCase().includes(filterName.toLowerCase())) return false;
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
                <div className="flex gap-4 border-b border-slate-200 pb-2 overflow-x-auto">
                    <button
                        className={`font-semibold pb-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === "USERS" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                        onClick={() => setActiveTab("USERS")}
                    >
                        가입자 목록
                    </button>
                    <button
                        className={`font-semibold pb-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${activeTab === "AI_HISTORY" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                        onClick={() => { setActiveTab("AI_HISTORY"); fetchAiHistory(); }}
                    >
                        최근 AI 매칭
                    </button>
                    <button
                        className={`font-semibold pb-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === "MATCHINGS" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                        onClick={() => setActiveTab("MATCHINGS")}
                    >
                        매칭 관리 ({matchings.length})
                    </button>
                    <button
                        className={`font-semibold pb-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === "NOTICES" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                        onClick={() => setActiveTab("NOTICES")}
                    >
                        공지사항 ({notices.length})
                    </button>
                    <button
                        className={`font-semibold pb-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${activeTab === "BATCH_AI" ? "border-purple-600 text-purple-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                        onClick={() => setActiveTab("BATCH_AI")}
                    >
                        <Zap className="w-3.5 h-3.5" />
                        N:M 배치 추천
                    </button>
                </div>

                {/* --- 유저 탭 --- */}
                {activeTab === "USERS" && (
                    <div className="space-y-6">
                        {/* 통계 카드 */}
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: "전체", value: users.length, color: "text-slate-900" },
                                { label: "매칭 활성", value: activeCount, color: "text-blue-600" },
                                { label: "활성 (남 / 여)", value: `${maleCount} / ${femaleCount}`, color: "text-slate-700" },
                            ].map(({ label, value, color }) => (
                                <Card key={label} className="shadow-sm">
                                    <CardContent className="py-3 px-1 text-center">
                                        <p className={`text-lg font-bold ${color} truncate`}>{value}</p>
                                        <p className="text-slate-500 text-[10px] mt-0.5 break-keep leading-tight">{label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* 필터 및 매칭 생성 액션 */}
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex flex-wrap gap-3 items-center">
                                <Input
                                    type="text"
                                    placeholder="이름 검색"
                                    value={filterName}
                                    onChange={(e) => setFilterName(e.target.value)}
                                    className="w-32 h-9 text-sm"
                                />
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
                                <select
                                    value={filterSmoking}
                                    onChange={(e) => setFilterSmoking(e.target.value as typeof filterSmoking)}
                                    className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">흡연: 전체</option>
                                    <option value="NON_SMOKER">비흡연</option>
                                    <option value="SMOKER">흡연</option>
                                </select>
                                <Button size="sm" variant="outline" onClick={fetchUsers} disabled={loadingUsers}>
                                    {loadingUsers ? "로딩 중..." : "새로고침"}
                                </Button>
                                <AdvancedFilterPanel
                                    onApply={handleApplyAdvancedFilters}
                                    activeCount={Object.keys(advancedFilters).length}
                                />
                                <span className="text-slate-400 text-sm">{filteredUsers.length}명</span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" onClick={handleSelectAllMale} className="bg-slate-100 hover:bg-slate-200 text-slate-700">남성 전체선택</Button>
                                <Button size="sm" variant="secondary" onClick={handleSelectAllFemale} className="bg-slate-100 hover:bg-slate-200 text-slate-700">여성 전체선택</Button>
                                {selectedUserIds.length > 0 && (
                                    <Button size="sm" variant="outline" onClick={handleDeselectAll} className="text-red-600 hover:text-red-700 hover:bg-red-50">선택 해제</Button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-4">
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
                            <div className="grid grid-cols-1 gap-8">
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
                                    <Card
                                        key={match.id}
                                        className="shadow-sm border-slate-200 overflow-hidden hover:border-blue-300 transition-colors"
                                    >
                                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                            <span>생성: {match.created_at ? new Date(match.created_at).toLocaleString() : "-"}</span>
                                            <div className="flex items-center gap-1.5">
                                                {(() => {
                                                    const isExpiredMatch = match.expires_at ? new Date(match.expires_at) < new Date() : false;
                                                    const hasNoResponse = isExpiredMatch && (match.user_a_status === "PENDING" || match.user_b_status === "PENDING");
                                                    if (match.is_contact_shared) return <span className="font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">매칭종료 ✓</span>;
                                                    if (match.user_a_status === "ACCEPTED" && match.user_b_status === "ACCEPTED") return <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">성사 완료! 🎉</span>;
                                                    if (match.user_a_status === "REJECTED" || match.user_b_status === "REJECTED") return <span className="font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">매칭 실패</span>;
                                                    if (hasNoResponse) return <span className="font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">무응답 ⏱️</span>;
                                                    return <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">진행 중 ⏳</span>;
                                                })()}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                                    onClick={() => setSelectedMatching(match)}
                                                >
                                                    <ExternalLink className="w-3 h-3 mr-1" />
                                                    상세/메시지
                                                </Button>
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
                                            <div className="grid grid-cols-1 divide-y divide-slate-100">
                                                {/* User A */}
                                                <div className={`p-4 flex flex-col gap-3 transition-colors ${match.user_a_info.gender === "MALE" ? "bg-blue-50/20" : "bg-pink-50/20"}`}>
                                                    <div
                                                        className="flex items-center gap-3 cursor-pointer group hover:bg-white/40 p-1 -m-1 rounded-lg transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedUser(match.user_a_info);
                                                        }}
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
                                                        {(() => {
                                                            const isExpiredMatch = match.expires_at ? new Date(match.expires_at) < new Date() : false;
                                                            const isNoResponse = isExpiredMatch && match.user_a_status === "PENDING";
                                                            return <span className={`text-xs font-bold ${match.user_a_status === "ACCEPTED" ? "text-green-600" : match.user_a_status === "REJECTED" ? "text-red-600" : isNoResponse ? "text-slate-400" : "text-slate-500"}`}>
                                                                {isNoResponse ? "무응답" : match.user_a_status}
                                                            </span>;
                                                        })()}
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
                                                        className="flex items-center gap-3 cursor-pointer group hover:bg-white/40 p-1 -m-1 rounded-lg transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedUser(match.user_b_info);
                                                        }}
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
                                                        {(() => {
                                                            const isExpiredMatch = match.expires_at ? new Date(match.expires_at) < new Date() : false;
                                                            const isNoResponse = isExpiredMatch && match.user_b_status === "PENDING";
                                                            return <span className={`text-xs font-bold ${match.user_b_status === "ACCEPTED" ? "text-green-600" : match.user_b_status === "REJECTED" ? "text-red-600" : isNoResponse ? "text-slate-400" : "text-slate-500"}`}>
                                                                {isNoResponse ? "무응답" : match.user_b_status}
                                                            </span>;
                                                        })()}
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

                {/* --- 공지사항 탭 --- */}
                {activeTab === "NOTICES" && (
                    <div className="space-y-6">
                        {/* 새로운 공지 작성 */}
                        <Card className="shadow-sm border-blue-100 bg-blue-50/10">
                            <CardHeader className="pb-3 px-6 pt-6 flex flex-row items-center gap-2">
                                <Megaphone className="w-5 h-5 text-blue-600" />
                                <CardTitle className="text-slate-900 text-lg">새 공지사항 작성</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 px-6 pb-6">
                                <div className="space-y-2">
                                    <Label className="text-slate-700 font-semibold text-sm">제목</Label>
                                    <Input
                                        placeholder="공지사항 제목을 입력하세요"
                                        value={newNotice.title}
                                        onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                                        className="bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-700 font-semibold text-sm">내용</Label>
                                    <Textarea
                                        placeholder="공지사항 내용을 입력하세요"
                                        value={newNotice.content}
                                        onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                                        className="min-h-[120px] bg-white"
                                    />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                    <div className="space-y-0.5">
                                        <Label className="text-slate-900 font-bold block">팝업 노출 여부</Label>
                                        <p className="text-[10px] text-slate-500 font-medium tracking-tight">체크 시 메인 페이지 접속 시 팝업으로 노출됩니다.</p>
                                    </div>
                                    <Switch
                                        checked={newNotice.is_popup}
                                        onCheckedChange={(val) => setNewNotice({ ...newNotice, is_popup: val })}
                                        className="data-[state=checked]:bg-blue-600"
                                    />
                                </div>
                                <Button
                                    onClick={handleCreateNotice}
                                    disabled={creatingNotice || !newNotice.title || !newNotice.content}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12"
                                >
                                    {creatingNotice ? "저장 중..." : "공지사항 등록하기"}
                                </Button>
                            </CardContent>
                        </Card>

                        {/* 공지사항 목록 */}
                        <div className="space-y-3">
                            <h3 className="text-slate-900 font-bold text-sm tracking-tight flex items-center gap-2 px-1">
                                검색 결과 <span className="text-blue-600">{notices.length}</span>건
                            </h3>
                            {notices.length === 0 ? (
                                <p className="text-center text-slate-400 py-12 bg-white rounded-xl border border-slate-100">등록된 공지사항이 없습니다.</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {notices.map((notice) => (
                                        <Card key={notice.id} className="shadow-sm border-slate-100 hover:border-blue-200 transition-colors group">
                                            <CardContent className="p-5 flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {notice.is_popup && (
                                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold shrink-0">팝업</span>
                                                        )}
                                                        <h4 className="text-sm font-bold text-slate-900 truncate">{notice.title}</h4>
                                                    </div>
                                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2 break-all">{notice.content}</p>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {new Date(notice.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setEditingNotice(notice)}
                                                        className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 h-8 w-8 p-0 transition-opacity"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteNotice(notice.id)}
                                                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0 transition-opacity"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- AI 추천 이력 탭 --- */}
                {activeTab === "AI_HISTORY" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-slate-500 text-sm">AI 추천 매칭 이력 (전체)</p>
                            <Button size="sm" variant="outline" onClick={fetchAiHistory} disabled={loadingAiHistory}>
                                {loadingAiHistory ? "로딩 중..." : "새로고침"}
                            </Button>
                        </div>

                        {loadingAiHistory ? (
                            <p className="text-center text-slate-400 py-16">이력을 불러오는 중...</p>
                        ) : aiHistory.length === 0 ? (
                            <div className="text-center text-slate-400 py-16 bg-white rounded-xl border border-slate-100">
                                <History className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                                <p className="text-sm">AI 추천 이력이 없습니다.</p>
                                <p className="text-xs mt-1 text-slate-300">가입자 탭에서 AI 추천을 먼저 실행해 주세요.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {aiHistory.map((hist) => {
                                    const candidateCount = Object.keys(hist.candidate_results).length;
                                    const topScore = candidateCount > 0
                                        ? Math.max(...Object.values(hist.candidate_results).map(r => r.score))
                                        : 0;
                                    return (
                                        <Card
                                            key={hist.id}
                                            className="shadow-sm border-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer group"
                                            onClick={() => setSelectedHistory(hist)}
                                        >
                                            <CardContent className="p-4 flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                                                        <Sparkles className="w-4 h-4 text-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                                                            {hist.target_user_name ?? hist.target_user_id.slice(0, 8) + "…"} 기준 추천
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                                            후보 {candidateCount}명 분석 · 최고점 {topScore}점 · {new Date(hist.created_at).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                                                        {topScore}점
                                                    </div>
                                                    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* --- N:M 배치 AI 추천 탭 --- */}
                {activeTab === "BATCH_AI" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-900 font-bold">N:M 배치 AI 매칭 추천</p>
                                <p className="text-slate-500 text-xs mt-0.5">남성과 여성을 각각 선택하면 AI가 쌍방향 적합도를 분석하여 중복 없이 최적의 쌍을 추천합니다.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">추천 건수</span>
                                <select
                                    value={batchTopN}
                                    onChange={e => setBatchTopN(Number(e.target.value))}
                                    className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    {[1,2,3,4,5].map(n => (
                                        <option key={n} value={n}>{n}쌍</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-blue-700">🎯 남성 ({batchTargetIds.length}명 선택)</p>
                                    <button className="text-[10px] text-slate-400 hover:text-red-500 transition-colors" onClick={() => setBatchTargetIds([])}>전체 해제</button>
                                </div>
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                    {users.filter(u => u.is_active && u.gender === "MALE").map(u => (
                                        <label key={u.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${batchTargetIds.includes(u.id) ? "bg-blue-50 border-blue-300" : "bg-white border-slate-100 hover:bg-slate-50"} ${batchCandidateIds.includes(u.id) ? "opacity-40 pointer-events-none" : ""}`}>
                                            <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={batchTargetIds.includes(u.id)} onChange={() => handleBatchToggleTarget(u.id)} disabled={batchCandidateIds.includes(u.id)} />
                                            <span className="text-[10px]">{u.gender === "MALE" ? "👨" : "👩"}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-slate-900 truncate">{u.name}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{u.birth_year % 100}년생 · {u.job}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-pink-700">💝 여성 ({batchCandidateIds.length}명 선택)</p>
                                    <button className="text-[10px] text-slate-400 hover:text-red-500 transition-colors" onClick={() => setBatchCandidateIds([])}>전체 해제</button>
                                </div>
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                    {users.filter(u => u.is_active && u.gender === "FEMALE").map(u => (
                                        <label key={u.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${batchCandidateIds.includes(u.id) ? "bg-pink-50 border-pink-300" : "bg-white border-slate-100 hover:bg-slate-50"} ${batchTargetIds.includes(u.id) ? "opacity-40 pointer-events-none" : ""}`}>
                                            <input type="checkbox" className="w-4 h-4 text-pink-600 rounded" checked={batchCandidateIds.includes(u.id)} onChange={() => handleBatchToggleCandidate(u.id)} disabled={batchTargetIds.includes(u.id)} />
                                            <span className="text-[10px]">{u.gender === "MALE" ? "👨" : "👩"}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-slate-900 truncate">{u.name}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{u.birth_year % 100}년생 · {u.job}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {batchError && (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                                <p className="text-sm text-red-600">{batchError}</p>
                            </div>
                        )}

                        <Button
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2"
                            onClick={handleRunBatchRecommend}
                            disabled={batchLoading || batchTargetIds.length === 0 || batchCandidateIds.length === 0}
                        >
                            {batchLoading ? (
                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />AI 분석 중... (타겟 {batchTargetIds.length}명 × 후보 {batchCandidateIds.length}명)</>
                            ) : (
                                <><Zap className="w-4 h-4" />AI 배치 추천 실행 ({batchTargetIds.length} × {batchCandidateIds.length})</>
                            )}
                        </Button>

                        {batchResults.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-purple-500" />
                                    <p className="text-sm font-bold text-slate-900">AI 추천 결과 (상위 {batchResults.length}쌍)</p>
                                </div>
                                {batchResults.map((item) => (
                                    <Card key={item.rank} className="border-purple-100 overflow-hidden shadow-sm">
                                        <div className="bg-gradient-to-r from-purple-50 to-white px-4 py-3 border-b border-purple-100 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black">{item.rank}</div>
                                                <div 
                                                    className="flex items-center gap-2 cursor-pointer group"
                                                    onClick={() => {
                                                        setAiTargetUserId(item.target_user.id);
                                                        setCompareBaseUser(item.target_user as UserReadAdmin);
                                                        const candObj = users.find(u => u.id === item.candidate_user.id) ?? item.candidate_user as UserReadAdmin;
                                                        setCompareCandidate(candObj);
                                                    }}
                                                >
                                                    <span className="text-sm font-bold text-blue-700 group-hover:underline decoration-dotted underline-offset-2 transition-all">{item.target_user.name}</span>
                                                    <span className="text-slate-400 group-hover:text-purple-500 transition-colors">↔</span>
                                                    <span className="text-sm font-bold text-pink-700 group-hover:underline decoration-dotted underline-offset-2 transition-all">{item.candidate_user.name}</span>
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {item.target_user.birth_year % 100}년생 · {item.target_user.job}<span className="mx-1">/</span>{item.candidate_user.birth_year % 100}년생 · {item.candidate_user.job}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] text-purple-500 font-semibold">AI 적합도</span>
                                                <div className="bg-purple-600 text-white font-bold text-base px-2.5 py-0.5 rounded shadow-sm">{item.score}점</div>
                                            </div>
                                        </div>
                                        <CardContent className="p-4 bg-white space-y-4">
                                            <div className="bg-slate-50 rounded p-3 border border-slate-100">
                                                <p className="font-semibold text-slate-900 mb-2 text-xs">🤖 AI 추천 사유 (수정 가능)</p>
                                                <Textarea
                                                    value={batchReasonEdits[item.rank] ?? item.reason}
                                                    onChange={e => setBatchReasonEdits(prev => ({ ...prev, [item.rank]: e.target.value }))}
                                                    className="text-xs bg-white border-slate-200 min-h-24 leading-relaxed resize-none focus:ring-1 focus:ring-purple-500"
                                                />
                                            </div>
                                            <Button
                                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold"
                                                disabled={creatingMatch}
                                                onClick={() => handleCreateBatchMatch(item)}
                                            >
                                                {creatingMatch ? "매칭 생성 중..." : `${item.target_user.name} ↔ ${item.candidate_user.name} 매칭 확정`}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* AI 추천 이력 상세 다이얼로그 */}
            {selectedHistory && (
                <Dialog open={!!selectedHistory} onOpenChange={(open) => !open && setSelectedHistory(null)}>
                    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
                        <DialogHeader>
                            <DialogTitle className="text-slate-900 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-500" />
                                {selectedHistory.target_user_name ?? "알 수 없음"} 기준 AI 추천 이력
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-[11px] text-slate-400 -mt-1">{new Date(selectedHistory.created_at).toLocaleString()}</p>

                        <div className="space-y-3 pt-2">
                            {Object.entries(selectedHistory.candidate_results).length === 0 ? (
                                <p className="text-center text-slate-400 py-8">저장된 후보 데이터가 없습니다.</p>
                            ) : (
                                Object.entries(selectedHistory.candidate_results)
                                    .sort(([, a], [, b]) => b.score - a.score)
                                    .map(([candidateId, data]) => {
                                        const candidateUser = users.find(u => u.id === candidateId);
                                        return (
                                            <div key={candidateId} className="bg-slate-50 rounded-lg border border-slate-100 p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div
                                                        className={candidateUser ? "cursor-pointer group/cand" : ""}
                                                        onClick={() => {
                                                            if (!candidateUser) return;
                                                            setAiTargetUserId(selectedHistory.target_user_id);
                                                            setCompareCandidate(candidateUser);
                                                        }}
                                                    >
                                                        <p className={`text-sm font-bold text-slate-900 ${candidateUser ? "group-hover/cand:text-indigo-600 underline decoration-dotted underline-offset-2 transition-colors" : ""}`}>
                                                            {candidateUser ? `${candidateUser.name} (${candidateUser.birth_year}년생)` : candidateId.slice(0, 8) + "…"}
                                                        </p>
                                                        {candidateUser && (
                                                            <p className="text-[10px] text-slate-400">{candidateUser.job} · <span className="text-indigo-400">클릭하여 비교</span></p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {candidateUser && (
                                                            <Button
                                                                size="sm"
                                                                className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                                                disabled={creatingMatch}
                                                                onClick={() => handleCreateMatchFromCompare_History(
                                                                    selectedHistory.target_user_id,
                                                                    candidateUser.id,
                                                                    data.score,
                                                                    data.reason,
                                                                )}
                                                            >
                                                                {creatingMatch ? "…" : "매칭하기"}
                                                            </Button>
                                                        )}
                                                        <div className="bg-indigo-600 text-white text-sm font-bold px-2.5 py-1 rounded-full">
                                                            {data.score}점
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-white rounded p-2.5 border border-slate-100">
                                                    <p className="text-[10px] font-semibold text-indigo-500 mb-1 flex items-center gap-1">
                                                        <Sparkles className="w-3 h-3" /> AI 추천 사유
                                                    </p>
                                                    <p className="text-xs text-slate-700 leading-relaxed">{data.reason}</p>
                                                </div>
                                            </div>
                                        );
                                    })
                            )}
                        </div>

                        <DialogFooter className="pt-2">
                            <Button variant="outline" className="w-full" onClick={() => setSelectedHistory(null)}>닫기</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* 상세 다이얼로그 */}
            <UserDetailDialog
                user={selectedUser}
                onClose={() => setSelectedUser(null)}
            />

            <CompareUsersDialog
                baseUser={compareBaseUser ?? users.find(u => u.id === aiTargetUserId) ?? null}
                targetUser={compareCandidate}
                onClose={() => { setCompareCandidate(null); setCompareBaseUser(null); }}
                onCreateMatch={handleCreateMatchFromCompare}
                creatingMatch={creatingMatch}
            />

            <MatchingDetailDialog
                matching={selectedMatching}
                onClose={() => setSelectedMatching(null)}
                onUpdate={(updated) => {
                    setMatchings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
                    setSelectedMatching(updated);
                }}
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
                                            <div
                                                className="bg-gradient-to-r from-indigo-50 to-white px-4 py-3 border-b border-indigo-100 flex items-center justify-between cursor-pointer hover:bg-indigo-50/50 transition-colors"
                                                onClick={() => setCompareCandidate(candidate)}
                                            >
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
                                                    <p className="font-semibold text-slate-900 mb-2 text-xs">🤖 AI 추천 사유 (수정 가능)</p>
                                                    <Textarea
                                                        value={result.reason}
                                                        onChange={(e) => {
                                                            const newReason = e.target.value;
                                                            setAiResults(prev => prev.map(res =>
                                                                res.candidate_id === result.candidate_id ? { ...res, reason: newReason } : res
                                                            ));
                                                        }}
                                                        className="text-xs bg-white border-slate-200 min-h-[100px] leading-relaxed resize-none focus:ring-1 focus:ring-indigo-500"
                                                        placeholder="AI 추천 사유를 입력하세요..."
                                                    />
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

            {/* 공지사항 수정 다이얼로그 */}
            {editingNotice && (
                <Dialog open={!!editingNotice} onOpenChange={(open) => !open && setEditingNotice(null)}>
                    <DialogContent className="max-w-md" aria-describedby={undefined}>
                        <DialogHeader>
                            <DialogTitle className="text-slate-900 flex items-center gap-2">
                                <Edit2 className="w-5 h-5 text-blue-600" />
                                공지사항 수정
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleUpdateNotice} className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label className="text-slate-700 font-semibold text-sm">제목</Label>
                                <Input
                                    value={editingNotice.title}
                                    onChange={(e) => setEditingNotice({ ...editingNotice, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-700 font-semibold text-sm">내용</Label>
                                <Textarea
                                    value={editingNotice.content}
                                    onChange={(e) => setEditingNotice({ ...editingNotice, content: e.target.value })}
                                    className="min-h-[150px]"
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="space-y-0.5">
                                    <Label className="text-slate-900 font-bold block">팝업 노출 여부</Label>
                                    <p className="text-[10px] text-slate-500 font-medium tracking-tight">체크 시 메인 페이지에 팝업으로 노출됩니다.</p>
                                </div>
                                <Switch
                                    checked={editingNotice.is_popup}
                                    onCheckedChange={(val) => setEditingNotice({ ...editingNotice, is_popup: val })}
                                    className="data-[state=checked]:bg-blue-600"
                                />
                            </div>
                            <DialogFooter className="gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setEditingNotice(null)}>취소</Button>
                                <Button
                                    type="submit"
                                    disabled={creatingNotice}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-6 rounded-xl"
                                >
                                    {creatingNotice ? "저장 중..." : "수정 완료"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </main>
    );
}
