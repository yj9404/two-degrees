"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getUser, updateUser, deleteUser } from "@/lib/api";
import type { UserUpdatePayload, Gender, SmokingStatus, DrinkingStatus } from "@/types/user";

import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ImageUploader from "@/components/ImageUploader";
import { SectionCard } from "@/components/SectionCard";
import { Field } from "@/components/Field";

function EditProfileContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const user_id = searchParams.get("user_id");

    const [form, setForm] = useState<UserUpdatePayload>({});
    const [isActive, setIsActive] = useState(true);
    const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
        "loading"
    );
    const [saveStatus, setSaveStatus] = useState<
        "idle" | "loading" | "success" | "error"
    >("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    // ── 상태 전이 핸들러 ──────────────────────────
    useEffect(() => {
        if (saveStatus === "success") {
            const timer = setTimeout(() => {
                router.push("/");
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [saveStatus, router]);

    // ── 기존 데이터 불러오기 (pre-fill) ──────────────────────────
    useEffect(() => {
        if (!user_id) {
            setLoadStatus("error");
            return;
        }
        getUser(user_id)
            .then((user) => {
                setForm({
                    name: user.name,
                    gender: user.gender,
                    birth_year: user.birth_year,
                    job: user.job,
                    referrer_name: user.referrer_name,
                    desired_conditions: user.desired_conditions,
                    deal_breakers: user.deal_breakers,
                    instagram_id: user.instagram_id ?? "",
                    photo_urls: user.photo_urls ?? [],
                    height: user.height ?? undefined,
                    active_area: user.active_area ?? "",
                    education: user.education ?? "",
                    workplace: user.workplace ?? "",
                    mbti: user.mbti ?? "",
                    smoking_status: user.smoking_status ?? undefined,
                    drinking_status: user.drinking_status ?? undefined,
                    religion: user.religion ?? "",
                    exercise: user.exercise ?? "",
                    hobbies: user.hobbies ?? "",
                    intro: user.intro ?? "",
                    age_preference: user.age_preference ?? [],
                    age_gap_older: user.age_gap_older ?? undefined,
                    age_gap_younger: user.age_gap_younger ?? undefined,
                });
                setIsActive(user.is_active);
                setLoadStatus("ready");
            })
            .catch(() => setLoadStatus("error"));
    }, [user_id]);

    // ── 핸들러 ────────────────────────────────────────────────────
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]:
                type === "number" ? (value === "" ? undefined : Number(value)) : value,
        }));
    };

    const handleSelect = (name: keyof UserUpdatePayload, value: string) => {
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // 연령 선호 토글 (다중 선택)
    const handleAgePreference = (value: "OLDER" | "YOUNGER" | "SAME" | "ANY") => {
        setForm((prev) => {
            const current = (prev.age_preference ?? []) as ("OLDER" | "YOUNGER" | "SAME" | "ANY")[];
            let next: typeof current;
            if (value === "ANY") {
                next = current.includes("ANY") ? [] : ["ANY"];
            } else {
                const withoutAny = current.filter((v) => v !== "ANY");
                next = withoutAny.includes(value)
                    ? withoutAny.filter((v) => v !== value)
                    : [...withoutAny, value];
            }
            return {
                ...prev,
                age_preference: next,
                age_gap_older: next.includes("OLDER") ? prev.age_gap_older : undefined,
                age_gap_younger: next.includes("YOUNGER") ? prev.age_gap_younger : undefined,
            };
        });
    };

    const showOlderGap = ((form.age_preference ?? []) as string[]).includes("OLDER");
    const showYoungerGap = ((form.age_preference ?? []) as string[]).includes("YOUNGER");

    const AGE_PREF_OPTIONS: { value: "OLDER" | "YOUNGER" | "SAME" | "ANY"; label: string }[] = [
        { value: "OLDER", label: "연상" },
        { value: "YOUNGER", label: "연하" },
        { value: "SAME", label: "동갑" },
        { value: "ANY", label: "상관없음" },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user_id) return;
        setSaveStatus("loading");
        setErrorMsg("");

        if (!form.photo_urls || form.photo_urls.length === 0) {
            setSaveStatus("error");
            setErrorMsg("프로필 사진을 최소 1장 이상 등록해 주세요.");
            return;
        }

        try {
            const raw = { ...form, is_active: isActive };
            const cleanedForm: UserUpdatePayload = {};
            for (const [k, v] of Object.entries(raw)) {
                if (v !== "") {
                    (cleanedForm as Record<string, unknown>)[k] = v;
                }
            }
            await updateUser(user_id, cleanedForm);
            setSaveStatus("success");
        } catch (err) {
            setSaveStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
        }
    };

    const handleDeleteAccount = async () => {
        if (!user_id) return;
        setIsDeleting(true);
        try {
            await deleteUser(user_id);
            alert("프로필이 성공적으로 삭제되었습니다.");
            router.push("/");
        } catch (err) {
            alert(err instanceof Error ? err.message : "삭제 실패");
            setIsDeleting(false);
        }
    };

    // ── 로딩/에러 상태 ────────────────────────────────────────────
    if (loadStatus === "loading") {
        return (
            <main className="min-h-[100dvh] flex items-center justify-center">
                <p className="text-slate-500 text-sm">프로필 불러오는 중...</p>
            </main>
        );
    }

    if (loadStatus === "error") {
        return (
            <main className="min-h-[100dvh] flex items-center justify-center px-4">
                <div className="text-center space-y-4">
                    <p className="text-slate-900 font-semibold">
                        프로필을 불러올 수 없습니다.
                    </p>
                    <Button variant="outline" onClick={() => router.push("/auth")}>
                        다시 인증하기
                    </Button>
                </div>
            </main>
        );
    }

    // ── 저장 완료 화면 ────────────────────────────────────────────
    if (saveStatus === "success") {
        return (
            <main className="min-h-screen flex items-center justify-center px-4">
                <div className="flex flex-col items-center gap-4 py-20 text-center animate-in fade-in zoom-in duration-500">
                    <div className="text-6xl animate-bounce">✅</div>
                    <h2 className="text-slate-900 font-bold text-2xl">수정 완료!</h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        프로필이 성공적으로 업데이트되었습니다.<br />
                        잠시 후 메인 페이지로 이동합니다.
                    </p>
                    <div className="mt-4 w-12 h-1 bg-blue-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 animate-[progress_3s_linear]" />
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-4 text-slate-400"
                        onClick={() => router.push("/")}
                    >
                        지금 바로 이동하기
                    </Button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-[100dvh] py-8 px-4">
            <div className="space-y-6">
                <div className="text-center space-y-1">
                    <h1 className="text-slate-900 font-semibold text-2xl tracking-tight">
                        TwoDegrees 💑
                    </h1>
                    <p className="text-slate-500 text-sm">내 프로필 수정</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 프로필 링크 공유 안내 배너 */}
                    <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                        <span className="text-lg">🌐</span>
                        <p className="text-blue-900 text-[13px] font-medium leading-snug">
                            항목명 옆에 <span className="font-bold">🌐</span> 표시가 된 정보는<br />
                            프로필 링크 공유 시 상대방에게 노출됩니다.
                        </p>
                    </div>

                    <Card className="shadow-sm border-2 border-blue-100 bg-blue-50/50">
                        <CardContent className="pt-4 pb-4 px-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-slate-900 font-semibold text-sm">
                                        매칭 풀에 내 프로필 노출하기
                                    </p>
                                    <p className="text-slate-500 text-xs">
                                        {isActive
                                            ? "✅ 현재 매칭 풀에 노출 중입니다."
                                            : "⏸️ 현재 매칭 풀에서 숨겨져 있습니다."}
                                    </p>
                                </div>
                                <Switch
                                    id="is-active-toggle"
                                    checked={isActive}
                                    onCheckedChange={setIsActive}
                                    className="data-[state=checked]:bg-blue-600"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <SectionCard title="🧑 기본 정보" description="변경할 정보를 수정해 주세요.">
                        <Field label="이름" required>
                            <Input id="edit-name" name="name" placeholder="홍길동" value={form.name ?? ""} onChange={handleChange} required />
                        </Field>
                        <Field label="성별" required>
                            <RadioGroup value={form.gender ?? ""} onValueChange={(v) => handleSelect("gender", v)} className="flex gap-8">
                                <div className="flex items-center gap-2">
                                    <RadioGroupItem value="MALE" id="edit-gender-male" />
                                    <Label htmlFor="edit-gender-male" className="font-normal cursor-pointer">남성</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <RadioGroupItem value="FEMALE" id="edit-gender-female" />
                                    <Label htmlFor="edit-gender-female" className="font-normal cursor-pointer">여성</Label>
                                </div>
                            </RadioGroup>
                        </Field>
                        <Field label="출생연도" required isPublic>
                            <Input id="edit-birth_year" name="birth_year" type="number" min={1980} max={2008} value={form.birth_year ?? ""} onChange={handleChange} required />
                        </Field>
                        <Field label="직업" required isPublic>
                            <Input id="edit-job" name="job" value={form.job ?? ""} onChange={handleChange} required />
                        </Field>
                        <Field label="소개해 준 지인 이름" required hint="신원 보증용. 실명을 입력해 주세요.">
                            <Input id="edit-referrer_name" name="referrer_name" value={form.referrer_name ?? ""} onChange={handleChange} required />
                        </Field>
                        <Field label="프로필 사진" required isPublic>
                            <ImageUploader value={form.photo_urls ?? []} onChange={(urls) => setForm((prev) => ({ ...prev, photo_urls: urls }))} />
                        </Field>
                    </SectionCard>

                    <SectionCard title="💌 상대방 조건" description="원하는 상대방의 조건을 자유롭게 작성해 주세요.">
                        <Field label="원하는 상대방 조건" required>
                            <Textarea id="edit-desired_conditions" name="desired_conditions" rows={4} value={form.desired_conditions ?? ""} onChange={handleChange} required minLength={10} className="resize-none" />
                        </Field>
                        <Field label="절대 기피하는 조건" required>
                            <Textarea id="edit-deal_breakers" name="deal_breakers" rows={3} value={form.deal_breakers ?? ""} onChange={handleChange} required minLength={10} className="resize-none" />
                        </Field>
                        <Field label="선호 연령대" required hint="복수 선택 가능.">
                            <div className="flex flex-wrap gap-2">
                                {AGE_PREF_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleAgePreference(opt.value)}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-colors
                                            ${((form.age_preference ?? []) as string[]).includes(opt.value)
                                                ? "bg-blue-600 text-white border-blue-600"
                                                : "bg-white text-slate-700 border-slate-200 hover:border-blue-400"
                                            }`}
                                    >
                                        {((form.age_preference ?? []) as string[]).includes(opt.value) ? "✓ " : ""}{opt.label}
                                    </button>
                                ))}
                            </div>
                            {showOlderGap && (
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-slate-600 text-sm shrink-0 w-20">연상 최대</span>
                                    <Input id="edit-age_gap_older" name="age_gap_older" type="number" min={1} max={20} value={form.age_gap_older ?? ""} onChange={handleChange} className="w-20" />
                                    <span className="text-slate-600 text-sm shrink-0">살</span>
                                </div>
                            )}
                            {showYoungerGap && (
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-slate-600 text-sm shrink-0 w-20">연하 최대</span>
                                    <Input id="edit-age_gap_younger" name="age_gap_younger" type="number" min={1} max={20} value={form.age_gap_younger ?? ""} onChange={handleChange} className="w-20" />
                                    <span className="text-slate-600 text-sm shrink-0">살</span>
                                </div>
                            )}
                        </Field>
                    </SectionCard>

                    <SectionCard title="📋 선택 정보" description="작성할수록 더 정확한 매칭이 가능합니다.">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="MBTI" isPublic><Input id="edit-mbti" name="mbti" value={form.mbti ?? ""} onChange={handleChange} maxLength={4} /></Field>
                            <Field label="종교" isPublic><Input id="edit-religion" name="religion" value={form.religion ?? ""} onChange={handleChange} /></Field>
                            <Field label="흡연 여부" isPublic>
                                <Select value={form.smoking_status ?? ""} onValueChange={(v) => handleSelect("smoking_status", v as SmokingStatus)}>
                                    <SelectTrigger id="edit-smoking_status"><SelectValue placeholder="선택" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NON_SMOKER">비흡연</SelectItem>
                                        <SelectItem value="SMOKER">흡연</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="음주 여부" isPublic>
                                <Select value={form.drinking_status ?? ""} onValueChange={(v) => handleSelect("drinking_status", v as DrinkingStatus)}>
                                    <SelectTrigger id="edit-drinking_status"><SelectValue placeholder="선택" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NON_DRINKER">비음주</SelectItem>
                                        <SelectItem value="SOCIAL_DRINKER">가끔</SelectItem>
                                        <SelectItem value="DRINKER">음주</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="키 (cm)" isPublic><Input id="edit-height" name="height" type="number" value={form.height ?? ""} onChange={handleChange} /></Field>
                            <Field label="운동" isPublic><Input id="edit-exercise" name="exercise" value={form.exercise ?? ""} onChange={handleChange} /></Field>
                        </div>
                        <Field label="주 활동 지역" isPublic><Input id="edit-active_area" name="active_area" value={form.active_area ?? ""} onChange={handleChange} /></Field>
                        <Field label="학력" isPublic><Input id="edit-education" name="education" value={form.education ?? ""} onChange={handleChange} /></Field>
                        <Field label="직장 위치" isPublic><Input id="edit-workplace" name="workplace" value={form.workplace ?? ""} onChange={handleChange} /></Field>
                        <Field label="취미" isPublic><Input id="edit-hobbies" name="hobbies" value={form.hobbies ?? ""} onChange={handleChange} /></Field>
                        <Field label="자기소개"><Textarea id="edit-intro" name="intro" rows={3} value={form.intro ?? ""} onChange={handleChange} /></Field>
                        <Field label="인스타그램 아이디"><Input id="edit-instagram_id" name="instagram_id" value={form.instagram_id ?? ""} onChange={handleChange} /></Field>
                    </SectionCard>

                    {saveStatus === "error" && <p className="text-red-500 text-sm text-center">{errorMsg}</p>}

                    <Button type="submit" disabled={saveStatus === "loading"} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-base">
                        {saveStatus === "loading" ? "저장 중..." : "프로필 저장하기"}
                    </Button>

                    <Button type="button" variant="ghost" className="w-full text-slate-500" onClick={() => router.push("/auth")}>
                        ← 인증 페이지로 돌아가기
                    </Button>
                </form>
                <p className="text-center text-slate-500 text-xs pb-8">입력하신 정보는 매칭 목적으로만 사용됩니다.</p>

                <div className="pt-8 pb-12 flex justify-center">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full sm:w-auto font-semibold">계정 삭제</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[90vw] max-w-md rounded-xl p-6">
                            <AlertDialogHeader>
                                <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription>모든 데이터가 영구적으로 삭제됩니다.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }} disabled={isDeleting} className="bg-red-500 hover:bg-red-600 text-white">
                                    {isDeleting ? "삭제 중..." : "확인"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </main>
    );
}

export default function EditProfilePage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-slate-50 flex items-center justify-center">
                <p className="text-slate-500 text-sm">로딩 중...</p>
            </main>
        }>
            <EditProfileContent />
        </Suspense>
    );
}
