"use client";

import { useState, useEffect } from "react";
import { registerUser, getUserStats } from "@/lib/api";
import type { UserCreatePayload, Gender, SmokingStatus, DrinkingStatus, UserStatsResponse } from "@/types/user";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ImageUploader from "@/components/ImageUploader";

// ────────────────────────────────────────────────────────────────
// 초기 폼 상태
// ────────────────────────────────────────────────────────────────
const INITIAL_FORM: Partial<UserCreatePayload> = {
    name: "",
    gender: undefined,
    birth_year: undefined,
    job: "",
    contact: "",
    password: "",
    referrer_name: "",
    desired_conditions: "",
    deal_breakers: "",
    instagram_id: "",
    height: undefined,
    active_area: "",
    education: "",
    workplace: "",
    mbti: "",
    smoking_status: undefined,
    drinking_status: undefined,
    religion: "",
    exercise: "",
    hobbies: "",
    intro: "",
    photo_urls: [],
    age_preference: [],
    age_gap_older: undefined,
    age_gap_younger: undefined,
};

// ────────────────────────────────────────────────────────────────
// 헬퍼: 섹션 헤더
// ────────────────────────────────────────────────────────────────
function SectionCard({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-4">
                <CardTitle className="text-slate-900 font-semibold text-base">
                    {title}
                </CardTitle>
                {description && (
                    <CardDescription className="text-slate-500 text-sm">
                        {description}
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="space-y-4">{children}</CardContent>
        </Card>
    );
}

// ────────────────────────────────────────────────────────────────
// 헬퍼: 필드 래퍼
// ────────────────────────────────────────────────────────────────
function Field({
    label,
    required,
    children,
    hint,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
    hint?: string;
}) {
    return (
        <div className="space-y-1">
            <Label className="text-slate-900 font-semibold text-sm">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            {children}
            {hint && <p className="text-slate-500 text-xs">{hint}</p>}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────────
export default function RegistrationForm() {
    const [form, setForm] = useState<Partial<UserCreatePayload>>(INITIAL_FORM);
    const [status, setStatus] = useState<
        "idle" | "loading" | "success" | "error"
    >("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [stats, setStats] = useState<UserStatsResponse | null>(null);

    useEffect(() => {
        getUserStats().then(setStats).catch(() => { });
    }, []);

    // 텍스트·숫자 입력 공통 핸들러
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === "number" ? (value === "" ? undefined : Number(value)) : value,
        }));
    };

    // Select / RadioGroup 공통 핸들러
    const handleSelect = (name: keyof UserCreatePayload, value: string) => {
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // 연령 선호 토글 (ANY 선택 시 다른 항목 해제)
    const handleAgePreference = (value: "OLDER" | "YOUNGER" | "SAME" | "ANY") => {
        setForm((prev) => {
            const current = prev.age_preference ?? [];
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
                // OLDER 해제되면 연상 나이차 삭제, YOUNGER 해제되면 연하 나이차 삭제
                age_gap_older: next.includes("OLDER") ? prev.age_gap_older : undefined,
                age_gap_younger: next.includes("YOUNGER") ? prev.age_gap_younger : undefined,
            };
        });
    };

    const showOlderGap = (form.age_preference ?? []).includes("OLDER");
    const showYoungerGap = (form.age_preference ?? []).includes("YOUNGER");

    const AGE_PREF_OPTIONS: { value: "OLDER" | "YOUNGER" | "SAME" | "ANY"; label: string }[] = [
        { value: "OLDER", label: "연상" },
        { value: "YOUNGER", label: "연하" },
        { value: "SAME", label: "동갑" },
        { value: "ANY", label: "상관없음" },
    ];

    // 제출 시 빈 문자열 필드 정리
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");
        setErrorMsg("");

        if (!form.age_preference || form.age_preference.length === 0) {
            setStatus("error");
            setErrorMsg("선호 연령대를 선택해 주세요.");
            return;
        }

        try {
            const cleaned: Partial<UserCreatePayload> = {};
            for (const [k, v] of Object.entries(form)) {
                if (v !== "") (cleaned as Record<string, unknown>)[k] = v;
            }
            await registerUser(cleaned as UserCreatePayload);
            setStatus("success");
        } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
        }
    };

    // ── 등록 완료 화면 ────────────────────────────────────────────
    if (status === "success") {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="text-5xl">🎉</div>
                <h2 className="text-slate-900 font-semibold text-xl">등록 완료!</h2>
                <p className="text-slate-500 text-sm">
                    소개팅 풀에 등록되었습니다.
                    <br />
                    매칭 연락을 기다려 주세요.
                </p>
                <Button
                    variant="outline"
                    onClick={() => {
                        setForm(INITIAL_FORM);
                        setStatus("idle");
                    }}
                >
                    다시 등록하기
                </Button>
                <a
                    href="/auth"
                    className="text-blue-600 text-sm font-semibold hover:underline"
                >
                    나중에 프로필 수정하기 →
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* 상단 배너 영역 */}
                <div className="space-y-2">
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

                    {/* 무료 안내 배너 */}
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                        <span className="text-green-600 text-lg">🎁</span>
                        <p className="text-green-700 text-sm font-semibold">
                            TwoDegrees의 모든 서비스는 <span className="underline">무료</span>입니다.
                        </p>
                    </div>
                </div>

                {/* ① 기본 정보 */}
                <SectionCard
                    title="🧑 기본 정보"
                    description="정확한 정보를 입력해 주세요. 허위 정보는 등록이 취소됩니다."
                >
                    {/* 이름 */}
                    <Field label="이름" required>
                        <Input
                            id="name"
                            name="name"
                            value={form.name ?? ""}
                            onChange={handleChange}
                            required
                        />
                    </Field>

                    {/* 성별 */}
                    <Field label="성별" required>
                        <RadioGroup
                            value={form.gender ?? ""}
                            onValueChange={(v) => handleSelect("gender", v)}
                            className="flex gap-8"
                            required
                        >
                            <div className="flex items-center gap-2">
                                <RadioGroupItem value="MALE" id="gender-male" />
                                <Label htmlFor="gender-male" className="font-normal cursor-pointer">남성</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <RadioGroupItem value="FEMALE" id="gender-female" />
                                <Label htmlFor="gender-female" className="font-normal cursor-pointer">여성</Label>
                            </div>
                        </RadioGroup>
                    </Field>

                    {/* 출생연도 */}
                    <Field label="출생연도" required>
                        <Input
                            id="birth_year"
                            name="birth_year"
                            type="number"
                            min={1980}
                            max={2008}
                            value={form.birth_year ?? ""}
                            onChange={handleChange}
                            required
                        />
                    </Field>

                    {/* 직업 */}
                    <Field label="직업" required>
                        <Input
                            id="job"
                            name="job"
                            value={form.job ?? ""}
                            onChange={handleChange}
                            required
                        />
                    </Field>

                    {/* 연락처 */}
                    <Field label="연락처" required hint="전화번호 또는 카카오톡 ID">
                        <Input
                            id="contact"
                            name="contact"
                            placeholder="010-0000-0000"
                            value={form.contact ?? ""}
                            onChange={handleChange}
                            required
                        />
                    </Field>

                    {/* 정보 수정용 비밀번호 */}
                    <Field
                        label="정보 수정용 비밀번호"
                        required
                        hint="나중에 프로필을 수정하거나 매칭 노출 여부를 변경할 때 사용합니다. (4자 이상)"
                    >
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="비밀번호를 입력해 주세요"
                            value={form.password ?? ""}
                            onChange={handleChange}
                            required
                            minLength={4}
                        />
                    </Field>

                    {/* 초대한 지인 */}
                    <Field label="소개해 준 지인 이름" required hint="신원 보증용. 실명을 입력해 주세요.">
                        <Input
                            id="referrer_name"
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
                            id="desired_conditions"
                            name="desired_conditions"
                            placeholder="예) 유머 감각이 있고 대화가 잘 통하는 분, 가족을 소중히 여기는 분... (최소 10자)"
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
                            id="deal_breakers"
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

                    {/* 선호 연령대 (필수) */}
                    <Field label="선호 연령대" required hint="복수 선택 가능. '상관없음' 선택 시 다른 항목 자동 해제">
                        <div className="flex flex-wrap gap-2">
                            {AGE_PREF_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleAgePreference(opt.value)}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-colors
                                    ${(form.age_preference ?? []).includes(opt.value)
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white text-slate-700 border-slate-200 hover:border-blue-400"
                                        }`}
                                >
                                    {(form.age_preference ?? []).includes(opt.value) ? "✓ " : ""}{opt.label}
                                </button>
                            ))}
                        </div>
                        {/* 연상 허용 나이차 */}
                        {showOlderGap && (
                            <div className="mt-3 flex items-center gap-2">
                                <span className="text-slate-600 text-sm shrink-0 w-20">연상 최대</span>
                                <Input
                                    id="age_gap_older"
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
                        {/* 연하 허용 나이차 */}
                        {showYoungerGap && (
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-slate-600 text-sm shrink-0 w-20">연하 최대</span>
                                <Input
                                    id="age_gap_younger"
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
                    {/* 2열 그리드: MBTI · 흡연 · 음주 · 종교 · 키 · 운동 */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="MBTI">
                            <Input
                                id="mbti"
                                name="mbti"
                                placeholder="예: ENFP"
                                value={form.mbti ?? ""}
                                onChange={handleChange}
                                maxLength={4}
                            />
                        </Field>

                        <Field label="종교">
                            <Input
                                id="religion"
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
                                <SelectTrigger id="smoking_status"><SelectValue placeholder="선택" /></SelectTrigger>
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
                                <SelectTrigger id="drinking_status"><SelectValue placeholder="선택" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NON_DRINKER">비음주</SelectItem>
                                    <SelectItem value="SOCIAL_DRINKER">가끔 (회식 등)</SelectItem>
                                    <SelectItem value="DRINKER">음주</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>

                        <Field label="키 (cm)">
                            <Input
                                id="height"
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
                                id="exercise"
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
                            id="active_area"
                            name="active_area"
                            placeholder="예: 서울 강남"
                            value={form.active_area ?? ""}
                            onChange={handleChange}
                        />
                    </Field>

                    <Field label="학력">
                        <Input
                            id="education"
                            name="education"
                            placeholder="예: ○○대학교"
                            value={form.education ?? ""}
                            onChange={handleChange}
                        />
                    </Field>

                    <Field label="직장 위치">
                        <Input
                            id="workplace"
                            name="workplace"
                            placeholder="예: 판교, 여의도"
                            value={form.workplace ?? ""}
                            onChange={handleChange}
                        />
                    </Field>

                    <Field label="취미">
                        <Input
                            id="hobbies"
                            name="hobbies"
                            placeholder="예: 등산, 연주, 요리"
                            value={form.hobbies ?? ""}
                            onChange={handleChange}
                        />
                    </Field>

                    <Field label="간단한 자기소개">
                        <Textarea
                            id="intro"
                            name="intro"
                            placeholder="자신을 간단히 소개해 보세요."
                            rows={3}
                            value={form.intro ?? ""}
                            onChange={handleChange}
                            className="resize-none"
                        />
                    </Field>

                    <Field label="인스타그램 아이디" hint="본인 확인 및 매칭 참고용으로 사용됩니다.">
                        <Input
                            id="instagram_id"
                            name="instagram_id"
                            type="text"
                            placeholder="예: hello_world"
                            value={form.instagram_id ?? ""}
                            onChange={handleChange}
                        />
                    </Field>

                    {/* 프로필 사진 */}
                    <Field label="프로필 사진">
                        <ImageUploader
                            value={form.photo_urls ?? []}
                            onChange={(urls) => setForm((prev) => ({ ...prev, photo_urls: urls }))}
                        />
                    </Field>
                </SectionCard>

                {/* 에러 메시지 */}
                {status === "error" && (
                    <p className="text-red-500 text-sm text-center">{errorMsg}</p>
                )}

                {/* 제출 버튼 */}
                <Button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-base"
                >
                    {status === "loading" ? "등록 중..." : "소개팅 풀 등록하기"}
                </Button>
            </form>

            {/* 매칭 진행 방식 FAQ */}
            <div className="pt-2 space-y-3 pb-4">
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
        </div>
    );
}
