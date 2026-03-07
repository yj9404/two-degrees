"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getUser, updateUser, getUserStats, deleteUser } from "@/lib/api";
import type { UserUpdatePayload, Gender, SmokingStatus, DrinkingStatus, UserStatsResponse } from "@/types/user";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
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

// ────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────────
export default function EditProfilePage() {
    const { user_id } = useParams<{ user_id: string }>();
    const router = useRouter();

    const [form, setForm] = useState<UserUpdatePayload>({});
    const [isActive, setIsActive] = useState(true);
    const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
        "loading"
    );
    const [saveStatus, setSaveStatus] = useState<
        "idle" | "loading" | "success" | "error"
    >("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [stats, setStats] = useState<UserStatsResponse | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ── 기존 데이터 불러오기 (pre-fill) ──────────────────────────
    useEffect(() => {
        if (!user_id) return;
        getUserStats().then(setStats).catch(() => { });

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
        setSaveStatus("loading");
        setErrorMsg("");

        try {
            // 빈 문자열 필드는 undefined로 정리하여 백엔드로 전송하지 않음
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
            <main className="min-h-screen bg-slate-50 flex items-center justify-center">
                <p className="text-slate-500 text-sm">프로필 불러오는 중...</p>
            </main>
        );
    }

    if (loadStatus === "error") {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
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
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <div className="text-5xl">✅</div>
                    <h2 className="text-slate-900 font-semibold text-xl">수정 완료!</h2>
                    <p className="text-slate-500 text-sm">
                        프로필이 성공적으로 업데이트되었습니다.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => setSaveStatus("idle")}
                    >
                        계속 수정하기
                    </Button>
                </div>
            </main>
        );
    }

    // ── 수정 폼 ──────────────────────────────────────────────────
    return (
        <main className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-md mx-auto space-y-6">
                {/* 헤더 */}
                <div className="text-center space-y-1">
                    <h1 className="text-slate-900 font-semibold text-2xl tracking-tight">
                        TwoDegrees 💑
                    </h1>
                    <p className="text-slate-500 text-sm">내 프로필 수정</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 통계 배너 */}
                    {stats && (
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                            <span className="text-blue-600 text-lg">📊</span>
                            <div className="text-blue-900 text-sm">
                                <span className="font-semibold block mb-0.5">현재 전체 프로필 성비 (활성화 기준)</span>
                                남 <span className="font-bold">{stats.male_ratio}%</span> / 여 <span className="font-bold">{stats.female_ratio}%</span>
                            </div>
                        </div>
                    )}

                    {/* ── 매칭 풀 노출 토글 ── */}
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

                    {/* ① 기본 정보 */}
                    <SectionCard
                        title="🧑 기본 정보"
                        description="변경할 정보를 수정해 주세요."
                    >
                        <Field label="이름" required>
                            <Input
                                id="edit-name"
                                name="name"
                                placeholder="홍길동"
                                value={form.name ?? ""}
                                onChange={handleChange}
                                required
                            />
                        </Field>

                        <Field label="성별" required>
                            <RadioGroup
                                value={form.gender ?? ""}
                                onValueChange={(v) => handleSelect("gender", v)}
                                className="flex gap-8"
                            >
                                <div className="flex items-center gap-2">
                                    <RadioGroupItem value="MALE" id="edit-gender-male" />
                                    <Label
                                        htmlFor="edit-gender-male"
                                        className="font-normal cursor-pointer"
                                    >
                                        남성
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <RadioGroupItem value="FEMALE" id="edit-gender-female" />
                                    <Label
                                        htmlFor="edit-gender-female"
                                        className="font-normal cursor-pointer"
                                    >
                                        여성
                                    </Label>
                                </div>
                            </RadioGroup>
                        </Field>

                        <Field label="출생연도" required>
                            <Input
                                id="edit-birth_year"
                                name="birth_year"
                                type="number"
                                min={1980}
                                max={2008}
                                value={form.birth_year ?? ""}
                                onChange={handleChange}
                                required
                            />
                        </Field>

                        <Field label="직업" required>
                            <Input
                                id="edit-job"
                                name="job"
                                value={form.job ?? ""}
                                onChange={handleChange}
                                required
                            />
                        </Field>

                        <Field label="소개해 준 지인 이름" required hint="신원 보증용. 실명을 입력해 주세요.">
                            <Input
                                id="edit-referrer_name"
                                name="referrer_name"
                                value={form.referrer_name ?? ""}
                                onChange={handleChange}
                                required
                            />
                        </Field>
                    </SectionCard>

                    {/* ② 상대방 조건 */}
                    <SectionCard
                        title="💌 상대방 조건"
                        description="원하는 상대방의 조건을 자유롭게 작성해 주세요. 구체적일수록 매칭 확률이 높아집니다."
                    >
                        <Field label="원하는 상대방 조건" required>
                            <Textarea
                                id="edit-desired_conditions"
                                name="desired_conditions"
                                placeholder="예) 유머 감각이 있고 대화가 잘 통하는 분... (최소 10자)"
                                rows={4}
                                value={form.desired_conditions ?? ""}
                                onChange={handleChange}
                                required
                                minLength={10}
                                className="resize-none"
                            />
                        </Field>

                        <Field label="절대 기피하는 조건" required>
                            <Textarea
                                id="edit-deal_breakers"
                                name="deal_breakers"
                                placeholder="예) 흡연자, 종교 강요, 매너 없는 분... (최소 10자)"
                                rows={3}
                                value={form.deal_breakers ?? ""}
                                onChange={handleChange}
                                required
                                minLength={10}
                                className="resize-none"
                            />
                        </Field>

                        {/* 선호 연령대 */}
                        <Field label="선호 연령대" required hint="복수 선택 가능. '상관없음' 선택 시 다른 항목 자동 해제">
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
                                    <Input
                                        id="edit-age_gap_older"
                                        name="age_gap_older"
                                        type="number"
                                        min={1}
                                        max={20}
                                        placeholder="예: 5"
                                        value={form.age_gap_older ?? ""}
                                        onChange={handleChange}
                                        className="w-20"
                                    />
                                    <span className="text-slate-600 text-sm shrink-0">살</span>
                                </div>
                            )}
                            {showYoungerGap && (
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-slate-600 text-sm shrink-0 w-20">연하 최대</span>
                                    <Input
                                        id="edit-age_gap_younger"
                                        name="age_gap_younger"
                                        type="number"
                                        min={1}
                                        max={20}
                                        placeholder="예: 3"
                                        value={form.age_gap_younger ?? ""}
                                        onChange={handleChange}
                                        className="w-20"
                                    />
                                    <span className="text-slate-600 text-sm shrink-0">살</span>
                                </div>
                            )}
                        </Field>
                    </SectionCard>

                    {/* ③ 선택 정보 */}
                    <SectionCard
                        title="📋 선택 정보"
                        description="작성할수록 더 정확한 매칭이 가능합니다. (모두 선택 사항)"
                    >
                        {/* 2열 그리드: MBTI · 종교 · 흡연 · 음주 · 키 · 운동 */}
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="MBTI">
                                <Input
                                    id="edit-mbti"
                                    name="mbti"
                                    placeholder="예: ENFP"
                                    value={form.mbti ?? ""}
                                    onChange={handleChange}
                                    maxLength={4}
                                />
                            </Field>

                            <Field label="종교">
                                <Input
                                    id="edit-religion"
                                    name="religion"
                                    placeholder="예: 무교"
                                    value={form.religion ?? ""}
                                    onChange={handleChange}
                                />
                            </Field>

                            <Field label="흡연 여부">
                                <Select
                                    value={form.smoking_status ?? ""}
                                    onValueChange={(v) => handleSelect("smoking_status", v as SmokingStatus)}
                                >
                                    <SelectTrigger id="edit-smoking_status"><SelectValue placeholder="선택" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NON_SMOKER">비흡연</SelectItem>
                                        <SelectItem value="SMOKER">흡연</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field label="음주 여부">
                                <Select
                                    value={form.drinking_status ?? ""}
                                    onValueChange={(v) => handleSelect("drinking_status", v as DrinkingStatus)}
                                >
                                    <SelectTrigger id="edit-drinking_status"><SelectValue placeholder="선택" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NON_DRINKER">비음주</SelectItem>
                                        <SelectItem value="SOCIAL_DRINKER">가끔 (회식 등)</SelectItem>
                                        <SelectItem value="DRINKER">음주</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field label="키 (cm)">
                                <Input
                                    id="edit-height"
                                    name="height"
                                    type="number"
                                    min={140}
                                    max={220}
                                    value={form.height ?? ""}
                                    onChange={handleChange}
                                />
                            </Field>

                            <Field label="운동">
                                <Input
                                    id="edit-exercise"
                                    name="exercise"
                                    placeholder="예: 주 3회 헬스"
                                    value={form.exercise ?? ""}
                                    onChange={handleChange}
                                />
                            </Field>
                        </div>

                        {/* 전체 너비 필드 */}
                        <Field label="주 활동 지역">
                            <Input
                                id="edit-active_area"
                                name="active_area"
                                placeholder="예: 서울 강남"
                                value={form.active_area ?? ""}
                                onChange={handleChange}
                            />
                        </Field>

                        <Field label="학력">
                            <Input
                                id="edit-education"
                                name="education"
                                placeholder="예: ○○대학교"
                                value={form.education ?? ""}
                                onChange={handleChange}
                            />
                        </Field>

                        <Field label="직장 위치">
                            <Input
                                id="edit-workplace"
                                name="workplace"
                                placeholder="예: 판교, 여의도"
                                value={form.workplace ?? ""}
                                onChange={handleChange}
                            />
                        </Field>

                        <Field label="취미">
                            <Input
                                id="edit-hobbies"
                                name="hobbies"
                                placeholder="예: 등산, 연주, 요리"
                                value={form.hobbies ?? ""}
                                onChange={handleChange}
                            />
                        </Field>

                        <Field label="간단한 자기소개">
                            <Textarea
                                id="edit-intro"
                                name="intro"
                                placeholder="자신을 간단히 소개해 보세요."
                                rows={3}
                                value={form.intro ?? ""}
                                onChange={handleChange}
                                className="resize-none"
                            />
                        </Field>

                        <Field
                            label="인스타그램 아이디"
                            hint="본인 확인 및 매칭 참고용으로 사용됩니다."
                        >
                            <Input
                                id="edit-instagram_id"
                                name="instagram_id"
                                type="text"
                                placeholder="예: hello_world"
                                value={form.instagram_id ?? ""}
                                onChange={handleChange}
                            />
                        </Field>

                        {/* 프로필 사진 */}
                        <Field
                            label="프로필 사진"
                        >
                            <ImageUploader
                                value={form.photo_urls ?? []}
                                onChange={(urls) => setForm((prev) => ({ ...prev, photo_urls: urls }))}
                            />
                        </Field>
                    </SectionCard>

                    {/* 에러 메시지 */}
                    {saveStatus === "error" && (
                        <p className="text-red-500 text-sm text-center">{errorMsg}</p>
                    )}

                    {/* 저장 버튼 */}
                    <Button
                        type="submit"
                        disabled={saveStatus === "loading"}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-base"
                    >
                        {saveStatus === "loading" ? "저장 중..." : "프로필 저장하기"}
                    </Button>

                    {/* 뒤로가기 */}
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full text-slate-500"
                        onClick={() => router.push("/auth")}
                    >
                        ← 인증 페이지로 돌아가기
                    </Button>
                </form>
                <p className="text-center text-slate-500 text-xs pb-8">
                    입력하신 정보는 매칭 목적으로만 사용됩니다.
                </p>

                {/* 매칭 진행 방식 FAQ */}
                <div className="pt-2 pb-4 space-y-3">
                    <details className="group bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden text-sm">
                        <summary className="flex items-center justify-between cursor-pointer p-4 font-semibold text-slate-800 list-none leading-tight [&::-webkit-details-marker]:hidden hover:bg-slate-50 transition-colors">
                            <span>💡 매칭은 어떻게 진행되나요?</span>
                            <span className="transition duration-300 group-open:-rotate-180 text-slate-400">
                                <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
                            </span>
                        </summary>
                        <div className="px-4 pb-4 text-slate-600 space-y-4 border-t border-slate-100 pt-4 leading-relaxed bg-slate-50/50">
                            <p>
                                TwoDegrees는 불필요한 감정 소모와 시간 낭비를 최소화하면서도 프라이버시를 철저히 보호합니다. 귀하의 프로필은 불특정 다수에게 절대 노출되지 않으며, 주선자가 직접 조건을 확인한 후 부합하는 상대에게만 <strong className="font-semibold text-slate-700">제한적으로 전달</strong>됩니다.
                            </p>
                            <div className="space-y-1">
                                <p className="font-semibold text-slate-800">Step 1. 프로필 및 사진 제안</p>
                                <p>주선자가 양측의 희망 조건과 기피 조건을 교차 검증하여 적합하다고 판단할 경우, 이름과 연락처를 제외한 <span className="font-medium text-slate-700">&apos;상세 텍스트 프로필&apos;</span>과 <span className="font-medium text-slate-700">&apos;사진&apos;</span>을 양측에 제안합니다.</p>
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-slate-800">Step 2. 상호 수락 및 연락처 교환</p>
                                <p>양측 모두 상대방의 프로필과 사진을 확인한 후 만남에 동의한 경우에만, <span className="font-medium text-slate-700">&apos;실명&apos;</span>과 <span className="font-medium text-slate-700">&apos;연락처&apos;</span>가 교환됩니다. 어느 한쪽이라도 거절할 경우, 추가적인 개인정보는 일절 전달되지 않고 해당 매칭은 즉시 종료됩니다.</p>
                            </div>
                        </div>
                    </details>

                    <details className="group bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden text-sm">
                        <summary className="flex items-center justify-between cursor-pointer p-4 font-semibold text-slate-800 list-none leading-tight [&::-webkit-details-marker]:hidden hover:bg-slate-50 transition-colors">
                            <span>💡 매칭 연락은 언제 오나요?</span>
                            <span className="transition duration-300 group-open:-rotate-180 text-slate-400">
                                <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
                            </span>
                        </summary>
                        <div className="px-4 pb-4 text-slate-600 space-y-4 border-t border-slate-100 pt-4 leading-relaxed bg-slate-50/50">
                            <p>
                                프로필 확인 후 적합한 상대방을 찾으면 주선자가 직접 연락을 드립니다. 매칭 제안 및 연락은 주로 <strong className="font-semibold text-slate-700">평일 오후 6시 ~ 10시</strong> 또는 <strong className="font-semibold text-slate-700">주말</strong>에 이루어질 예정입니다.
                            </p>
                        </div>
                    </details>
                </div>

                {/* 계정 삭제 */}
                <div className="pt-8 pb-12 flex justify-center">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full sm:w-auto font-semibold">
                                계정 삭제 (Delete Account)
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[90vw] max-w-md rounded-xl p-6">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl">정말 프로필을 삭제하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription className="text-base text-slate-500">
                                    이 작업은 되돌릴 수 없으며, 모든 데이터가 영구적으로 삭제됩니다.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-4 sm:space-x-2">
                                <AlertDialogCancel disabled={isDeleting} className="mt-2 sm:mt-0">취소</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleDeleteAccount();
                                    }}
                                    disabled={isDeleting}
                                    className="bg-red-500 hover:bg-red-600 focus:ring-red-500 text-white border-0"
                                >
                                    {isDeleting ? "삭제 중..." : "확인 (Continue)"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>


            </div>
        </main>
    );
}
