"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { getSharedProfile, respondSharedMatching } from "@/lib/api";
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

    const handleScroll = () => {
        if (scrollRef.current) {
            const scrollLeft = scrollRef.current.scrollLeft;
            const width = scrollRef.current.offsetWidth;
            const index = Math.round(scrollLeft / width);
            if (index !== activePhotoIndex) {
                setActivePhotoIndex(index);
            }
        }
    };

    const scrollToPhoto = (idx: number) => {
        if (scrollRef.current) {
            const width = scrollRef.current.offsetWidth;
            scrollRef.current.scrollTo({
                left: width * idx,
                behavior: "smooth"
            });
            setActivePhotoIndex(idx);
        }
    };

    useEffect(() => {
        if (token) {
            getSharedProfile(token)
                .then(setProfile)
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
                    <div
                        ref={scrollRef}
                        className="relative aspect-[3/4] bg-slate-900 overflow-x-auto flex snap-x snap-mandatory scrollbar-hide"
                        onScroll={handleScroll}
                        style={{ WebkitTouchCallout: 'none', scrollBehavior: 'smooth' }}
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
                        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-black/40 backdrop-blur-md text-white border-t border-white/10 z-30 pointer-events-none">
                            <div className="flex items-baseline gap-2">
                                <h1 className="text-2xl font-bold tracking-tight">{profile.age}세</h1>
                                <span className="text-xs font-medium opacity-40">|</span>
                                <p className="text-sm font-medium opacity-90 truncate max-w-[220px]">{profile.job}</p>
                            </div>
                        </div>
                    </div>

                    {/* Thumbnail Strip */}
                    {profile.photo_urls && profile.photo_urls.length > 1 && (
                        <div className="px-6 py-4 flex gap-2 overflow-x-auto scrollbar-hide">
                            {profile.photo_urls.map((url, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => scrollToPhoto(idx)}
                                    className={`relative w-16 h-20 rounded-lg overflow-hidden shrink-0 cursor-pointer transition-all ${activePhotoIndex === idx
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
                    <div className="px-6 space-y-1.5">
                        {profile.photo_urls && profile.photo_urls.length > 1 && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
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
