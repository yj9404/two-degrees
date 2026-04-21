"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { getSharedProfile, respondSharedMatching, agreePenaltyPolicy } from "@/lib/api";
import { SharedProfileRead, MatchStatus } from "@/types/user";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Clock,
    MapPin,
    Briefcase,
    Ruler,
    Sparkles,
    CheckCircle2,
    XCircle,
    GraduationCap,
    Building2,
    Fingerprint,
    Church,
    Cigarette,
    Wine,
    Dumbbell,
    Palette,
    Cake,
    MessageCircle,
    ShieldCheck
} from "lucide-react";

export default function SharedProfilePage() {
    const { token } = useParams<{ token: string }>();
    const [profile, setProfile] = useState<(SharedProfileRead & { expires_at?: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [responded, setResponded] = useState<MatchStatus | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [activePhotoIndex, setActivePhotoIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // 페널티 정책 동의 모달 상태
    const [showPolicyModal, setShowPolicyModal] = useState(false);
    const [policyScrolled, setPolicyScrolled] = useState(false);
    const [policyAgreeing, setPolicyAgreeing] = useState(false);
    const policyContentRef = useRef<HTMLDivElement>(null);

    const [isScrolling, setIsScrolling] = useState(false);
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    const handleScroll = () => {
        if (scrollRef.current && !isScrolling) {
            const scrollLeft = scrollRef.current.scrollLeft;
            const width = scrollRef.current.offsetWidth;
            const index = Math.round(scrollLeft / width);
            if (index !== activePhotoIndex) {
                // Ensure index is within bounds for state, though looping logic handles the actual scroll
                const photoCount = profile?.photo_urls?.length || 0;
                if (photoCount > 0) {
                    setActivePhotoIndex(index % photoCount);
                }
            }
        }
    };

    const scrollToPhoto = (idx: number, behavior: ScrollBehavior = "smooth") => {
        if (scrollRef.current) {
            const width = scrollRef.current.offsetWidth;
            setIsScrolling(true);
            scrollRef.current.scrollTo({
                left: width * idx,
                behavior
            });

            // Wait for scroll animation to finish
            setTimeout(() => {
                setIsScrolling(false);
                const photoCount = profile?.photo_urls?.length || 0;
                if (photoCount > 0) {
                    setActivePhotoIndex(idx % photoCount);
                }
            }, 500);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (isScrolling || !profile?.photo_urls) return;

        const deltaX = touchStartX.current - touchEndX.current;
        const threshold = 50; // Minimum swipe distance
        const photoCount = profile.photo_urls.length;

        if (Math.abs(deltaX) > threshold) {
            if (deltaX > 0) {
                // Swipe Left -> Next Photo
                const nextIndex = activePhotoIndex + 1;
                if (nextIndex >= photoCount) {
                    // Loop to start
                    scrollToPhoto(0);
                } else {
                    scrollToPhoto(nextIndex);
                }
            } else {
                // Swipe Right -> Previous Photo
                const prevIndex = activePhotoIndex - 1;
                if (prevIndex < 0) {
                    // Loop to end
                    scrollToPhoto(photoCount - 1);
                } else {
                    scrollToPhoto(prevIndex);
                }
            }
        }
    };

    useEffect(() => {
        if (token) {
            getSharedProfile(token)
                .then((data) => {
                    setProfile(data);
                    // 정책 미동의 유저에게만 모달 노출
                    if (!data.has_agreed_penalty_policy) {
                        setShowPolicyModal(true);
                    }
                })
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false));
        }
    }, [token]);

    useEffect(() => {
        if (!profile?.expires_at) return;

        const updateTimer = () => {
            const now = new Date().getTime();
            const expiryStr = profile.expires_at!;
            const end = new Date(expiryStr.endsWith('Z') || expiryStr.includes('+') ? expiryStr : expiryStr + 'Z').getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft("만료됨");
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            const hStr = h.toString();
            const mStr = m.toString().padStart(2, '0');
            const sStr = s.toString().padStart(2, '0');

            setTimeLeft(`${hStr}:${mStr}:${sStr}`);
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);

        return () => clearInterval(timer);
    }, [profile?.expires_at]);

    const handleRespond = async (status: MatchStatus) => {
        if (!token) return;
        try {
            await respondSharedMatching(token, { status });
            setResponded(status);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "응답 처리 중 오류가 발생했습니다.";
            alert(errorMessage);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center shadow-sm">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-slate-900 mb-2">접근할 수 없는 링크입니다.</h1>
                    <p className="text-slate-500 text-sm mb-6">{error || "만료되었거나 유효하지 않은 링크입니다."}</p>
                    <div className="pt-4 border-t border-slate-100 italic">
                        <p className="text-slate-400 text-xs mb-3 font-medium">링크 작동에 문제가 있나요?</p>
                        <a
                            href="http://pf.kakao.com/_jnxiZX/chat"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-[#FEE500] hover:bg-[#F7E100] text-[#191919] text-xs font-bold py-2.5 px-5 rounded-full transition-all shadow-sm"
                        >
                            <MessageCircle size={14} fill="#191919" />
                            <span>고객센터 문의하기</span>
                        </a>
                    </div>
                </Card>
            </div>
        );
    }

    if (responded) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center shadow-sm">
                    <CheckCircle2 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-slate-900 mb-2">응답이 기록되었습니다.</h1>
                    <p className="text-slate-500 text-sm">상대방의 수락 여부에 따라 추후 안내될 예정입니다.</p>
                </Card>
            </div>
        );
    }

    // Derive badge data
    const badges: { label: string; icon: React.ReactNode }[] = [];
    if (profile.age) badges.push({ label: `${profile.age}세`, icon: <Cake className="w-3 h-3" /> });
    if (profile.job) badges.push({ label: profile.job, icon: <Briefcase className="w-3 h-3" /> });
    if (profile.active_area) badges.push({ label: profile.active_area, icon: <MapPin className="w-3 h-3" /> });
    if (profile.height) badges.push({ label: `${profile.height}cm`, icon: <Ruler className="w-3 h-3" /> });
    if (profile.education) badges.push({ label: profile.education, icon: <GraduationCap className="w-3 h-3" /> });
    if (profile.workplace) badges.push({ label: profile.workplace, icon: <Building2 className="w-3 h-3" /> });
    if (profile.mbti) badges.push({ label: profile.mbti, icon: <Fingerprint className="w-3 h-3" /> });
    if (profile.religion) badges.push({ label: profile.religion, icon: <Church className="w-3 h-3" /> });
    if (profile.exercise) badges.push({ label: profile.exercise, icon: <Dumbbell className="w-3 h-3" /> });
    if (profile.hobbies) badges.push({ label: profile.hobbies, icon: <Palette className="w-3 h-3" /> });
    if (profile.smoking_status) {
        const label = profile.smoking_status === "SMOKER" ? "흡연" : profile.smoking_status === "NON_SMOKER" ? "비흡연" : null;
        if (label) badges.push({ label, icon: <Cigarette className="w-3 h-3" /> });
    }
    if (profile.drinking_status) {
        const label = profile.drinking_status === "DRINKER" ? "자주 마심" : profile.drinking_status === "SOCIAL_DRINKER" ? "상황에 따라" : profile.drinking_status === "NON_DRINKER" ? "안 마심" : null;
        if (label) badges.push({ label, icon: <Wine className="w-3 h-3" /> });
    }

    return (
        <div
            className="min-h-screen bg-slate-50 select-none pb-24"
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* ── 페널티 정책 동의 모달 ── */}
            {showPolicyModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    {/* 딤 배경 – 클릭해도 닫히지 않음 */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="relative w-full max-w-md mx-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
                        {/* 헤더 */}
                        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
                            <h2 className="text-base font-bold text-slate-900 leading-snug">
                                🚨 [필독] TwoDegrees 매칭 페널티 제도 안내
                            </h2>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                소중한 매칭 프로필을 확인하시기 전에, 원활한 매칭을 위한 새로운 이용 규칙을 안내해 드립니다.
                            </p>
                        </div>

                        {/* 본문 – 스크롤 가능 */}
                        <div
                            ref={policyContentRef}
                            className="flex-1 overflow-y-auto px-5 py-4 text-sm text-slate-700 leading-relaxed space-y-3"
                            onScroll={() => {
                                const el = policyContentRef.current;
                                if (!el) return;
                                // 스크롤이 바닥에 거의 닿으면(10px 여유) 활성화
                                if (el.scrollHeight - el.scrollTop - el.clientHeight < 10) {
                                    setPolicyScrolled(true);
                                }
                            }}
                        >
                            <p>안녕하세요, TwoDegrees 관리자입니다.</p>
                            <p>
                                TwoDegrees는 지인 네트워크를 기반으로 운영되는 전면 무료 매칭 서비스입니다.
                                한 분 한 분 신중하게 고민하여 매칭을 보내드리고 있으나, 잦은 거절과 무응답으로 인해
                                진지하게 인연을 기다리시는 분들의 피로도가 함께 높아지고 있습니다.
                            </p>
                            <p>
                                이에 따라 매칭 생태계를 건강하게 유지하기 위해{" "}
                                <strong>5월 1일부터 매칭 페널티 제도를 도입합니다.</strong>
                            </p>

                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                                <p className="font-semibold text-slate-800">[페널티 부과 기준]</p>
                                <ul className="space-y-1 pl-1">
                                    <li>• 매칭 거절: <strong>1점</strong></li>
                                    <li>• 무응답 (24시간 내 미확인/미선택): <strong>1.5점</strong></li>
                                </ul>
                            </div>

                            <div className="rounded-xl bg-red-50 border border-red-100 p-4 space-y-2">
                                <p className="font-semibold text-red-700">이용 제한 (14일 매칭 정지)</p>
                                <p className="text-sm text-red-600">
                                    누적 점수 3점 이상 도달 시, 그 시점으로부터 14일간 매칭이 중단됩니다.
                                </p>
                                <p className="text-sm text-slate-600">
                                    점수 초기화: 누적 점수가 3점 미만인 경우, 매월 1일에 0점으로 일괄 초기화됩니다.
                                    (단, 이미 14일 정지 상태인 분들은 정지 해제 이후 0점으로 초기화됩니다.)
                                </p>
                            </div>

                            <p className="text-slate-500 text-xs">위 제도의 점수/일수 제한은 상황에 따라 유동적으로 변경될 수 있습니다.</p>

                            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 space-y-2">
                                <p className="font-semibold text-blue-800">[안내 사항]</p>
                                <p>
                                    한정된 매칭 풀로 인해, 여러분이 설정하신 '선호/기피 조건'을 100% 완벽하게
                                    걸러내지 못하는 경우가 발생할 수 있습니다.
                                </p>
                                <p>
                                    저 역시 더 나은 매칭을 위해 노력하고 있지만, 무료 운영 시스템의 특성상 모든 조건을
                                    충족시키지 못할 수 있는 점 너그러운 양해 부탁드립니다. 다만 지인 네트워크를 통해
                                    신원이 확인된 분들인 만큼, 너무 부담 갖지 마시고 가벼운 마음으로 대화를 시작해
                                    보시길 권해 드립니다.
                                </p>
                            </div>

                            <p>
                                TwoDegrees는 모두가 기분 좋게 이용할 수 있는 서비스를 지향합니다.
                                이 제도는 누군가를 제재하기 위함이 아니라, 매칭에 진심인 분들을 보호하기 위한
                                최소한의 장치임을 양해해 주시기 바랍니다.
                            </p>
                            <p className="font-medium">감사합니다.</p>
                            {/* 스크롤 유도 패딩 */}
                            <div className="h-4" />
                        </div>

                        {/* 푸터 */}
                        <div className="px-5 py-4 border-t border-slate-100 bg-white">
                            {!policyScrolled && (
                                <p className="text-center text-xs text-slate-400 mb-3">
                                    ↓ 아래로 스크롤하여 내용을 확인해 주세요
                                </p>
                            )}
                            <button
                                disabled={!policyScrolled || policyAgreeing}
                                onClick={async () => {
                                    if (!profile?.current_user_id) return;
                                    setPolicyAgreeing(true);
                                    try {
                                        await agreePenaltyPolicy(profile.current_user_id);
                                        setShowPolicyModal(false);
                                    } catch {
                                        alert("동의 처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
                                    } finally {
                                        setPolicyAgreeing(false);
                                    }
                                }}
                                className={`w-full h-12 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                    policyScrolled && !policyAgreeing
                                        ? "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
                                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                }`}
                            >
                                {policyAgreeing ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        처리 중...
                                    </>
                                ) : (
                                    "확인 및 동의합니다"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="max-w-md mx-auto min-h-screen bg-white shadow-sm flex flex-col">
                {/* Expiration Banner */}
                {profile.expires_at && (
                    <div className="bg-baby-blue px-4 py-2.5 flex items-center justify-between border-b border-blue-200/50 shadow-sm font-nanum">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-700/80" />
                            <span className="text-[11px] text-blue-900 font-bold uppercase tracking-tight">
                                남은 시간
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-extrabold text-blue-900 tabular-nums tracking-wider">
                                {timeLeft}
                            </span>
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto pb-4 select-none" style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
                    {/* ── SECTION 1: Photo Gallery ── */}
                    <div className="pt-6 pb-2">
                        <div
                            ref={scrollRef}
                            className="relative w-1/2 mx-auto aspect-[3/4] bg-slate-900 overflow-x-hidden flex snap-x snap-mandatory rounded-2xl shadow-sm"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            style={{ WebkitTouchCallout: 'none' }}
                        >
                            {profile.photo_urls && profile.photo_urls.length > 0 ? (
                                profile.photo_urls.map((url, idx) => (
                                    <div key={idx} className="relative w-full h-full flex-shrink-0 snap-center">
                                        <Image
                                            src={url}
                                            alt=""
                                            fill
                                            className="object-cover blur-2xl opacity-40 scale-110"
                                            draggable={false}
                                        />
                                        <Image
                                            src={url}
                                            alt={`Profile Photo ${idx + 1}`}
                                            fill
                                            className="object-contain transition-all duration-300 relative z-10"
                                            priority={idx === 0}
                                            draggable={false}
                                        />
                                        <div
                                            className="absolute inset-0 z-20 bg-transparent"
                                            style={{ WebkitTouchCallout: 'none' }}
                                            onContextMenu={(e) => e.preventDefault()}
                                        />
                                    </div>
                                ))
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 w-full h-full">
                                    <Sparkles className="w-8 h-8 mb-2 opacity-50" />
                                    <span className="text-xs font-medium">프로필 사진이 없습니다.</span>
                                </div>
                            )}

                            {/* Overlay: age + job */}
                            <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-black/40 backdrop-blur-md text-white border-t border-white/10 z-30 pointer-events-none">
                                <div className="flex items-baseline gap-2">
                                    <h1 className="text-xl font-bold tracking-tight">{profile.age}세</h1>
                                    <span className="text-[10px] font-medium opacity-40">|</span>
                                    <p className="text-xs font-medium opacity-90 truncate max-w-[120px]">{profile.job}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Thumbnail Strip */}
                    {profile.photo_urls && profile.photo_urls.length > 1 && (
                        <div className="px-6 pb-4 flex justify-center gap-2 overflow-x-auto scrollbar-hide">
                            {profile.photo_urls.map((url, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => scrollToPhoto(idx)}
                                    className={`relative w-12 h-16 rounded-md overflow-hidden shrink-0 cursor-pointer transition-all ${activePhotoIndex === idx
                                        ? "ring-2 ring-blue-500 ring-offset-2 scale-105"
                                        : "opacity-60 grayscale-[30%] hover:opacity-100"
                                        }`}
                                    style={{ WebkitTouchCallout: 'none' }}
                                >
                                    <Image
                                        src={url}
                                        alt={`Thumbnail ${idx + 1}`}
                                        fill
                                        className="object-cover"
                                        draggable={false}
                                    />
                                    <div
                                        className="absolute inset-0 z-10 bg-transparent"
                                        onContextMenu={(e) => e.preventDefault()}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Swipe hint + privacy notice */}
                    <div className="px-6 space-y-1.5 text-center">
                        {profile.photo_urls && profile.photo_urls.length > 1 && (
                            <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                사진을 옆으로 밀어서 볼 수 있습니다.
                            </p>
                        )}
                        <p className="text-[9px] text-slate-400 leading-tight">
                            * 프라이버시 보호를 위해 캡처 및 무단 저장을 금지하며, 위반 시 서비스 이용이 제한될 수 있습니다.
                        </p>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* ── SECTION 2: Hero – Storytelling (추천 사유) ── */}
                        <Card className="border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm">
                            <CardContent className="px-5 py-0">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className="text-lg">💌</span>
                                    <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">주선자의 추천 편지</span>
                                </div>
                                <div className="relative">
                                    {/* decorative opening quote */}
                                    <span className="absolute -top-2 -left-1 text-5xl text-amber-200 font-serif leading-none select-none">&ldquo;</span>
                                    <p className="text-slate-700 text-[15px] leading-relaxed pt-2 pl-4 pr-1 italic font-medium">
                                        {profile.ai_reason ?? "주선자가 직접 선별하여 추천한 매칭입니다."}
                                    </p>
                                    <span className="float-right text-5xl text-amber-200 font-serif leading-none select-none" style={{ marginTop: '-1.25rem' }}>&rdquo;</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── SECTION 3: Trust Badge (검증 완료) ── */}
                        <Card className="border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-sm">
                            <CardContent className="px-4 py-0 flex items-start gap-3">
                                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-emerald-800 mb-0.5">주선자 &amp; AI 검증 완료</p>
                                    <p className="text-[12px] text-emerald-700 leading-snug">
                                        설정하신 조건들을 종합적으로 분석하여 높은 적합도를 보인 인연입니다.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── SECTION 4: Basic Info Accordion ── */}
                        {badges.length > 0 && (
                            <Accordion type="single" collapsible className="border border-slate-100 rounded-xl overflow-hidden">
                                <AccordionItem value="info" className="border-none">
                                    <AccordionTrigger className="px-4 py-3 text-sm font-semibold text-slate-700 hover:no-underline hover:bg-slate-50">
                                        기본 정보 보기
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4">
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {badges.map((badge, i) => (
                                                <span
                                                    key={i}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-full"
                                                >
                                                    {badge.icon}
                                                    {badge.label}
                                                </span>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}
                    </div>
                </div>

                {/* ── CTA Nudge + Action Buttons ── */}
                <div className="p-4 pt-2 border-t border-slate-100 fixed bottom-0 max-w-md w-full bg-white/90 backdrop-blur-md space-y-3">
                    <p className="text-center text-[12px] text-slate-500 font-medium">
                        ✨ 자세한 매력은 직접 대화하며 알아가 보세요!
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="h-12 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100 font-semibold">
                                    거절하기
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>매칭을 거절하시겠습니까?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        이 선택은 변경할 수 없으며, 확인을 누르면 링크가 즉시 만료됩니다.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => handleRespond("REJECTED")}
                                        className="bg-red-500 hover:bg-red-600 rounded-xl"
                                    >
                                        거절 확정
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                                    수락하기
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>매칭을 수락하시겠습니까?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        상대방도 수락할 경우 서로의 연락처가 공개됩니다. 이 선택은 취소할 수 없으며, 확인을 누르면 링크가 즉시 만료됩니다.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => handleRespond("ACCEPTED")}
                                        className="bg-blue-600 hover:bg-blue-700 rounded-xl"
                                    >
                                        수락 확정
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                {/* Footer Inquiry */}
                <div className="pb-36 pt-6 text-center space-y-3">
                    <p className="text-slate-400 text-[10px] font-medium tracking-tight">링크 작동에 문제가 있나요?</p>
                    <a
                        href="http://pf.kakao.com/_jnxiZX/chat"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 font-bold text-xs underline underline-offset-4 decoration-blue-100 hover:decoration-blue-400 transition-all uppercase tracking-tighter"
                    >
                        고객센터 문의
                    </a>
                </div>
            </div>
        </div>
    );
}
