import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Lock, CheckCircle2 } from "lucide-react";

interface StripeDummyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onPaymentAttempt?: () => void;
    amount: number;
    userEmail?: string;
    userName?: string;
}

const StripeDummyModal: React.FC<StripeDummyModalProps> = ({ isOpen, onClose, onSuccess, onPaymentAttempt, amount, userEmail, userName }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);

        // Start backend call in parallel if parent provided a handler
        if (onPaymentAttempt) onPaymentAttempt();

        // Simulate Stripe payment processing (1s for status change as requested)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setIsProcessing(false);
        setIsSuccess(true);

        // Notify parent to finalize navigation
        onSuccess();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && !isSuccess && !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                {isSuccess ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                            <CheckCircle2 className="w-12 h-12" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Order Placed!</h2>
                        <p className="text-gray-500 text-center">Your order has been successfully received.</p>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="bg-blue-600 text-white p-1 rounded">
                                    <CreditCard size={18} />
                                </div>
                                <span className="font-bold text-xl text-blue-600">Stripe</span>
                                <span className="bg-gray-100 text-gray-500 text-[10px] px-1 rounded ml-1">TEST MODE</span>
                            </div>
                            <DialogTitle className="text-2xl font-bold">Pay KSh {amount}</DialogTitle>
                            <DialogDescription>
                                Enter your card details to complete the payment securely.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handlePay} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" placeholder="customer@example.com" required defaultValue={userEmail || "guest@dineiq.com"} />
                            </div>

                            <div className="space-y-2">
                                <Label>Card Information</Label>
                                <div className="relative">
                                    <Input
                                        placeholder="1234 5678 1234 5678"
                                        className="pr-10"
                                        required
                                        maxLength={19}
                                        defaultValue="4242 4242 4242 4242"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        <CreditCard size={18} />
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <Input placeholder="MM / YY" required maxLength={7} defaultValue="12 / 28" />
                                    <Input placeholder="CVC" type="password" required maxLength={4} defaultValue="123" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Name on Card</Label>
                                <Input id="name" placeholder="Full Name" required defaultValue={userName || "John Doe"} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="country">Country or region</Label>
                                <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                    <option>India</option>
                                    <option>United States</option>
                                    <option>United Kingdom</option>
                                </select>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-bold"
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Processing...
                                    </div>
                                ) : (
                                    `Pay KSh ${amount}`
                                )}
                            </Button>
                        </form>

                        <DialogFooter className="sm:justify-center">
                            <div className="flex items-center gap-1 text-gray-500 text-xs">
                                <Lock size={12} />
                                <span>Secure payment powered by Stripe</span>
                            </div>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default StripeDummyModal;
