import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { postCampaign } from '@/api';
import { format } from 'date-fns';
import { CalendarIcon, Send, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageTemplate {
    template: string;
    timing: string;
}

interface CampaignFormProps {
    onSuccess?: () => void;
}

export function CampaignForm({ onSuccess }: CampaignFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const categories = [
        "Vegetarian", "Non-Vegetarian", "Vegan", "Eggetarian", "Jain",
        "Low Spender", "Mid Spender", "High Spender", "Premium Spender",
        "Occasional", "Regular", "Frequent", "Loyal",
        "Value-Seeker", "Quality-Seeker", "Experimenter",
        "Coupon-Driven", "Refund-Prone",
        "Breakfast", "Lunch", "Dinner", "Late-Night",
        "Weekend-Only", "Weekday-Only",
        "North Indian", "South Indian"
    ];

    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [channels, setChannels] = useState({
        SMS: true,
        WhatsApp: true,
        Email: true,
    });

    const [formData, setFormData] = useState({
        campaignText: 'Frontend: Campaign Text',
        startDate: undefined as Date | undefined,
        startTime: '09:00',
        endDate: undefined as Date | undefined,
        endTime: '21:00',
        campaignMessageCount: 0,
    });

    // Initialize 10 message templates
    const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>(
        Array.from({ length: 10 }, (_, i) => ({
            template: `Frontend Message Template ${i + 1}`,
            timing: `${String(9 + i).padStart(2, "0")}:00`,
        }))
    );

    const updateMessageTemplate = (index: number, field: 'template' | 'timing', value: string) => {
        setMessageTemplates(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleChannelChange = (channel: keyof typeof channels) => {
        setChannels(prev => ({ ...prev, [channel]: !prev[channel] }));
    };

    const handleCategoryChange = (category: string) => {
        setSelectedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.campaignText || selectedCategories.length === 0 || !formData.startDate || !formData.endDate) {
            toast.error('Please fill in all required fields');
            return;
        }

        const selectedChannels = Object.entries(channels)
            .filter(([_, checked]) => checked)
            .map(([name]) => name);

        if (selectedChannels.length === 0) {
            toast.error('Please select at least one campaign type');
            return;
        }

        if (formData.campaignMessageCount < 0 || formData.campaignMessageCount > 10) {
            toast.error('Message count must be either 0 (Initial Value) or between 1 and 10');
            return;
        }

        if (formData.campaignMessageCount > 0) {
            for (let i = 0; i < formData.campaignMessageCount; i++) {
                if (!messageTemplates[i].template.trim()) {
                    toast.error(`Please provide Message Template #${i + 1}`);
                    return;
                }
            }
        }

        setIsSubmitting(true);

        try {
            const startDateTime = `${format(formData.startDate, 'yyyy-MM-dd')} ${formData.startTime}`;
            const endDateTime = `${format(formData.endDate, 'yyyy-MM-dd')} ${formData.endTime}`;

            const payload: any = {
                campaignText: formData.campaignText,
                targetClientCategory: selectedCategories.join(', '),
                startDateTime,
                endDateTime,
                campaignMessageCount: formData.campaignMessageCount,
                campaignType: selectedChannels.join(','),
            };

            if (formData.campaignMessageCount > 0) {
                for (let i = 0; i < formData.campaignMessageCount && i < 10; i++) {
                    payload[`messageTemplate${i + 1}`] = messageTemplates[i].template;
                    payload[`messageSendTiming${i + 1}`] = messageTemplates[i].timing;
                }
            }

            await postCampaign(payload);
            toast.success('Campaign created successfully!');

            if (onSuccess) {
                onSuccess();
            }

            // Reset
            setFormData({
                campaignText: 'Frontend: Campaign Text',
                startDate: undefined,
                startTime: '09:00',
                endDate: undefined,
                endTime: '21:00',
                campaignMessageCount: 0,
            });
            setSelectedCategories([]);
            setChannels({ SMS: true, WhatsApp: true, Email: true });
            setMessageTemplates(
                Array.from({ length: 10 }, (_, i) => ({
                    template: `Frontend Message Template ${i + 1}`,
                    timing: `${String(9 + i).padStart(2, "0")}:00`,
                }))
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create campaign');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Campaign Details</CardTitle>
                    <CardDescription>Configure your marketing campaign settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="campaignText">Campaign Text *</Label>
                        <Textarea
                            id="campaignText"
                            value={formData.campaignText}
                            onChange={(e) => setFormData({ ...formData, campaignText: e.target.value })}
                            rows={4}
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <Label>Target Client Category *</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-lg border bg-muted/20 max-h-[300px] overflow-y-auto">
                            {categories.map((cat) => (
                                <div key={cat} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={cat}
                                        checked={selectedCategories.includes(cat)}
                                        onCheckedChange={() => handleCategoryChange(cat)}
                                    />
                                    <label htmlFor={cat} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                        {cat}
                                    </label>
                                </div>
                            ))}
                        </div>
                        <p className="text-[0.8rem] text-muted-foreground">Select multiple categories. They will be saved as comma-separated values.</p>
                    </div>

                    <div className="space-y-3">
                        <Label>Campaign Type *</Label>
                        <div className="flex gap-6">
                            {(['SMS', 'WhatsApp', 'Email'] as const).map((channel) => (
                                <div key={channel} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={channel.toLowerCase()}
                                        checked={channels[channel]}
                                        onCheckedChange={() => handleChannelChange(channel)}
                                    />
                                    <label htmlFor={channel.toLowerCase()} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        {channel}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Label>Start Date & Time *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !formData.startDate && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.startDate ? format(formData.startDate, 'PPP') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.startDate}
                                        onSelect={(date) => setFormData({ ...formData, startDate: date })}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <div className="relative">
                                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="time"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label>End Date & Time *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
                                            !formData.endDate && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.endDate ? format(formData.endDate, 'PPP') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.endDate}
                                        onSelect={(date) => setFormData({ ...formData, endDate: date })}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <div className="relative">
                                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="time"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="messageCount">Campaign Message Count (0-10) *</Label>
                        <Input
                            id="messageCount"
                            type="number"
                            min="0"
                            max="10"
                            value={formData.campaignMessageCount}
                            onChange={(e) => setFormData({ ...formData, campaignMessageCount: Number(e.target.value) })}
                            required
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Message Templates</CardTitle>
                    <CardDescription>Configure your campaign messages and timing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {Array.from({ length: formData.campaignMessageCount }, (_, index) => (
                        <div key={index} className="space-y-4 p-4 rounded-lg border bg-muted/30">
                            <h4 className="font-semibold text-sm">Message #{index + 1}</h4>
                            <div className="space-y-2">
                                <Label htmlFor={`template${index}`}>Message Template *</Label>
                                <Textarea
                                    id={`template${index}`}
                                    placeholder="Enter message template..."
                                    value={messageTemplates[index].template}
                                    onChange={(e) => updateMessageTemplate(index, 'template', e.target.value)}
                                    rows={3}
                                    required={formData.campaignMessageCount > 0}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`timing${index}`}>Send Time *</Label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id={`timing${index}`}
                                        type="time"
                                        value={messageTemplates[index].timing}
                                        onChange={(e) => updateMessageTemplate(index, 'timing', e.target.value)}
                                        className="pl-10"
                                        required={formData.campaignMessageCount > 0}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[200px]">
                    {isSubmitting ? 'Submitting...' : <> <Send className="mr-2 h-4 w-4" /> Create Campaign </>}
                </Button>
            </div>
        </form>
    );
}
