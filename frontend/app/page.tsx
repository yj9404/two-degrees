import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Sparkles,
  UserPlus,
  Search,
  MessageCircle,
  Heart,
  ArrowRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FAQSection from "@/components/FAQSection";
import LiveStats from "@/components/LiveStats";

export const metadata: Metadata = {
  title: "TwoDegrees – 폐쇄형 프라이빗 매칭 서비스",
  description: "지인의 지인까지만 연결되는 가장 안전한 소개팅 플랫폼",
};

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] pb-12">
      {/* 1. Hero Section */}
      <section className="relative pt-12 pb-10 px-6 text-center space-y-8 overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 bg-[radial-gradient(circle_at_5x_5%,#eff6ff,transparent_50%)]" />

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
          <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
          <span className="text-slate-600 text-[10px] font-bold tracking-tight">지인 기반 프라이빗 매칭</span>
        </div>

        <h1 className="text-slate-900 font-bold text-3xl tracking-tight leading-[1.25] break-keep">
          세상 모든 인연은 6단계면 닿지만, 우리는 딱 <span className="text-blue-600 underline underline-offset-4 decoration-2 decoration-blue-200">2단계</span>까지만 믿기로 했습니다.
        </h1>

        <p className="text-slate-500 text-base font-medium break-keep leading-relaxed px-2">
          지인의 지인까지만 연결되는,<br />가장 안전한 프라이빗 매칭 서비스 TwoDegrees
        </p>

        <div className="pt-2 flex flex-col gap-3">
          <Link href="/register">
            <Button size="lg" className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95">
              지금 바로 등록하기
            </Button>
          </Link>
          <Link href="/auth">
            <Button variant="ghost" className="w-full text-slate-500 font-semibold">
              이미 등록하셨나요? →
            </Button>
          </Link>
        </div>
      </section>

      {/* 실시간 현황 섹션 */}
      <section className="px-6 py-8 bg-slate-50/50">
        <div className="mb-4 text-center">
          <h3 className="text-slate-900 font-bold text-sm tracking-tight">현재 실시간 활동 현황</h3>
        </div>
        <LiveStats />
      </section>

      {/* 2. Story Section (The Origin) */}
      <section className="py-16 px-6 bg-white">
        <div className="space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-slate-900 font-bold text-2xl">왜 2단계(Two Degrees)인가요?</h2>
            <p className="text-slate-500 text-sm font-medium">우리가 안전한 네트워크에 집착하는 이유</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-4">
              <div className="p-6 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                <div className="text-3xl">🌍</div>
                <h3 className="text-slate-900 font-bold text-lg">6단계 분리의 법칙(Six Degrees of Separation)</h3>
                <p className="text-slate-600 text-sm leading-relaxed break-keep font-medium">
                  지구상의 모든 사람은 평균 6명을 거치면 아는 사이가 된다고 합니다. 하지만 모르는 6명 사이의 연결은 "신뢰"를 보장하지 못합니다.
                </p>
              </div>
              <div className="p-6 bg-blue-50 rounded-2xl space-y-3 border border-blue-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <ShieldCheck size={80} className="text-blue-600" />
                </div>
                <div className="text-3xl">🤝</div>
                <h3 className="text-blue-900 font-bold text-lg">TwoDegrees의 약속</h3>
                <p className="text-blue-800 text-sm leading-relaxed break-keep font-bold">
                  우리는 오직 "내 지인"과 "내 지인의 지인"까지만 선별하여 연결합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Values */}
      <section className="py-16 px-6">
        <div className="space-y-12">
          <div className="text-center space-y-3">
            <h3 className="text-slate-900 font-bold text-xl">신뢰를 만드는 세 가지 가치</h3>
            <p className="text-slate-500 text-sm">TwoDegrees가 다른 서비스와 차별화되는 점입니다.</p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            <Card className="border-0 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white group transition-transform">
              <CardContent className="p-8 space-y-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <ShieldCheck size={24} />
                </div>
                <h4 className="text-slate-900 font-bold">Verified Network</h4>
                <p className="text-slate-500 text-sm leading-relaxed break-keep font-medium">
                  실명이 확인된 지인 추천을 통해서만 가입할 수 있는 폐쇄형 네트워크로 운영됩니다.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white group transition-transform">
              <CardContent className="p-8 space-y-4">
                <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center group-hover:bg-pink-600 group-hover:text-white transition-colors">
                  <Lock size={24} />
                </div>
                <h4 className="text-slate-900 font-bold">Privacy First</h4>
                <p className="text-slate-500 text-sm leading-relaxed break-keep font-medium">
                  프로필은 매칭 상대에게만 공개되며, 매칭 제안은 24시간 동안만 유효합니다.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white group transition-transform">
              <CardContent className="p-8 space-y-4">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Sparkles size={24} />
                </div>
                <h4 className="text-slate-900 font-bold">AI + Human</h4>
                <p className="text-slate-500 text-sm leading-relaxed break-keep font-medium">
                  정교한 알고리즘과 주선자의 섬세한 안목을 결합하여 최적의 인연을 찾습니다.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 4. Process Section */}
      <section className="py-16 px-6 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_50%_50%,#3b82f6,transparent_50%)]" />

        <div className="space-y-16 relative">
          <div className="text-center space-y-3">
            <h3 className="text-white font-bold text-2xl">매칭은 이렇게 진행됩니다</h3>
            <p className="text-slate-400 text-sm">심플하지만 철저한 등록부터 성사까지의 흐름</p>
          </div>

          <div className="grid grid-cols-2 gap-y-12 gap-x-6">
            {[
              { icon: <UserPlus />, label: "등록", desc: "내 정보를 등록합니다" },
              { icon: <Search />, label: "분석", desc: "AI와 관리자가 교차분석을 합니다" },
              { icon: <MessageCircle />, label: "제안", desc: "검증된 프로필을 제안합니다" },
              { icon: <Heart />, label: "성사", desc: "상호 수락 시 연락처 교환" },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center space-y-4 group">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  {step.icon}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-lg">{step.label}</div>
                  <p className="text-slate-400 text-[11px] break-keep px-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-8 text-center">
            <Link href="/register">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-12 rounded-2xl h-14">
                지금 바로 시작하기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 5. FAQ Section */}
      <section className="py-20 px-6">
        <div className="space-y-12">
          <div className="text-center space-y-3">
            <h3 className="text-slate-900 font-bold text-2xl">자주 묻는 질문</h3>
            <p className="text-slate-500 text-sm">서비스 이용에 대해 궁금한 점을 확인해 보세요.</p>
          </div>

          <FAQSection />

          <div className="pt-12 text-center border-t border-slate-200">
            <div className="flex flex-col items-center gap-4">
              <p className="text-slate-400 text-xs">
                © 2026 TwoDegrees. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
