"use client";

import { useEffect, useState } from "react";
import { getLatestPopupNotice } from "@/lib/api";
import { Notice } from "@/types/user";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function NoticeModal() {
    const [notice, setNotice] = useState<Notice | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const fetchNotice = async () => {
            try {
                const latest = await getLatestPopupNotice();
                if (!latest) return;

                // localStorage 확인
                const dismissedId = localStorage.getItem("dismissedNoticeId");
                if (dismissedId !== latest.id.toString()) {
                    setNotice(latest);
                    setIsOpen(true);
                }
            } catch (error) {
                console.error("Failed to fetch latest popup notice:", error);
            }
        };

        fetchNotice();
    }, []);

    const handleDismissPermanently = () => {
        if (notice) {
            localStorage.setItem("dismissedNoticeId", notice.id.toString());
        }
        setIsOpen(false);
    };

    if (!notice) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-xs sm:max-w-md bg-white border-none shadow-xl rounded-2xl p-0 overflow-hidden">
                <div className="bg-blue-600 px-4 py-3">
                    <DialogHeader>
                        <DialogTitle className="text-white text-base font-bold flex items-center gap-2">
                            <span>📢</span> 공지사항
                        </DialogTitle>
                    </DialogHeader>
                </div>
                
                <div className="p-6">
                    <h3 className="text-slate-900 font-semibold mb-3">{notice.title}</h3>
                    <div className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                        {notice.content}
                    </div>
                </div>

                <DialogFooter className="flex flex-row border-t border-slate-100 p-2 bg-slate-50 gap-2">
                    <Button
                        variant="ghost"
                        onClick={handleDismissPermanently}
                        className="flex-1 text-slate-500 text-xs hover:bg-slate-200"
                    >
                        다시 보지 않기
                    </Button>
                    <Button
                        onClick={() => setIsOpen(false)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                        닫기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
