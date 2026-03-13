import React from 'react';
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2 } from "lucide-react";

interface CashDummyModalProps {
    isOpen: boolean;
    status: 'idle' | 'processing' | 'success';
}

const CashDummyModal: React.FC<CashDummyModalProps> = ({ isOpen, status }) => {
    return (
        <Dialog open={isOpen}>
            <DialogContent className="sm:max-w-[400px] border-none shadow-2xl bg-white/95 backdrop-blur-sm p-0 overflow-hidden">
                <div className="py-16 flex flex-col items-center justify-center space-y-6">
                    {status === 'processing' && (
                        <>
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-orange-100 rounded-full" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <h2 className="text-2xl font-bold text-gray-800">Placing Order</h2>
                                <p className="text-gray-500">Please wait while we confirm your order...</p>
                            </div>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 animate-in zoom-in duration-300">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h2 className="text-2xl font-bold text-gray-800">Order Placed!</h2>
                                <p className="text-gray-500">Your order has been successfully received.</p>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CashDummyModal;
