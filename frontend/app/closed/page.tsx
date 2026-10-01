import type { Metadata } from "next";
import { Heart } from "lucide-react";

export const metadata: Metadata = {
  title: "TwoDegrees – 서비스 종료 안내",
  description: "TwoDegrees 서비스가 종료되었습니다. 그동안 이용해 주셔서 감사합니다.",
  robots: { index: false, follow: false },
};

export default function ClosedPage() {
  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="space-y-8 max-w-sm">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto">
          <Heart size={32} />
        </div>

        <div className="space-y-3">
          <p className="text-xl font-bold text-slate-900 tracking-tighter">
            Two<span className="text-blue-600">Degrees</span>
          </p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight break-keep">
            서비스가 종료되었습니다
          </h1>
        </div>

        <p className="text-slate-500 text-sm leading-relaxed break-keep font-medium">
          TwoDegrees 서비스의 운영을 종료하게 되었습니다.<br />
          그동안 TwoDegrees를 이용해 주시고 아껴 주신<br />
          모든 분들께 진심으로 감사드립니다.
        </p>

        <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest pt-4 border-t border-slate-100">
          © 2026 Team TwoDegrees
        </p>
      </div>
    </main>
  );
}
