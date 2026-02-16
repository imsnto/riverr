
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Rocket, Building2, Puzzle, Check } from 'lucide-react';
import Image from 'next/image';

interface OnboardingGuideProps {
  onComplete: () => void;
}

const steps = [
  {
    title: "Welcome to Manowar!",
    description: "Your new business OS. Let's get you set up with a quick tour of the basics.",
    icon: <Rocket className="h-12 w-12 text-primary" />,
    imageSeed: 'welcome'
  },
  {
    title: "What are Spaces?",
    description: "Spaces are the highest level of organization, perfect for separating different companies, clients, or large departments.",
    icon: <Building2 className="h-12 w-12 text-primary" />,
    imageSeed: 'spaces'
  },
  {
    title: "What are Hubs?",
    description: "Inside each Space, you can create multiple Hubs. Think of them as dedicated workspaces for specific projects or teams, like 'Marketing' or 'Q3 Product Launch'.",
    icon: <Puzzle className="h-12 w-12 text-primary" />,
    imageSeed: 'hubs'
  },
  {
    title: "Power Up with Features",
    description: "Each Hub can be customized with features like Task Boards, Knowledge Bases, Inboxes, and more. You only add what you need, keeping your workspace clean.",
    icon: <Puzzle className="h-12 w-12 text-primary" />,
    imageSeed: 'features'
  },
  {
    title: "You're All Set!",
    description: "That's it! You're ready to create your first Space. You can always change these settings later.",
    icon: <Check className="h-12 w-12 text-primary" />,
    imageSeed: 'complete'
  }
];

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [step, setStep] = useState(0);

  const currentStep = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(isOpen) => { if (!isOpen) onComplete(); }}>
      <DialogContent className="sm:max-w-lg p-0">
        <div className="p-6">
          <DialogHeader className="text-center items-center">
            <div className="bg-primary/10 p-3 rounded-full mb-4">
              {currentStep.icon}
            </div>
            <DialogTitle className="text-2xl">{currentStep.title}</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              {currentStep.description}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="bg-muted/50 p-6 border-y">
            <Image 
                src={`https://picsum.photos/seed/${currentStep.imageSeed}/600/400`}
                width={600}
                height={400}
                alt={currentStep.title}
                className="rounded-lg shadow-lg w-full h-auto"
                data-ai-hint="abstract illustration"
            />
        </div>
        <DialogFooter className="p-6 flex justify-between w-full">
            <div>
                {step > 0 && (
                    <Button variant="ghost" onClick={handlePrev}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                    </Button>
                )}
            </div>
          
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    {steps.map((_, i) => (
                        <div key={i} className={`h-2 w-2 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-muted'}`} />
                    ))}
                </div>
                <Button onClick={handleNext}>
                    {step === steps.length - 1 ? 'Get Started' : 'Next'}
                    {step < steps.length - 1 && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
