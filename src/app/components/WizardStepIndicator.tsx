type WizardStep = "upload" | "extracting" | "extracted" | "analyzing" | "analyzed" | "report";

interface WizardStepIndicatorProps {
  currentStep: WizardStep;
}

const STEPS = [
  { label: "Upload", states: ["upload", "extracting"] },
  { label: "Extract", states: ["extracted", "analyzing"] },
  { label: "AI Analysis", states: ["analyzed"] },
  { label: "Report", states: ["report"] },
];

function getStepIndex(step: WizardStep): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].states.includes(step)) return i;
  }
  return 0;
}

export default function WizardStepIndicator({ currentStep }: WizardStepIndicatorProps) {
  const activeIndex = getStepIndex(currentStep);
  const isProcessing = currentStep === "extracting" || currentStep === "analyzing";

  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, i) => {
        const isCompleted = i < activeIndex;
        const isActive = i === activeIndex;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  isCompleted
                    ? "bg-blue-600 text-white"
                    : isActive
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs mt-1 font-medium ${
                  isActive ? "text-blue-600" : isCompleted ? "text-gray-600" : "text-gray-400"
                }`}
              >
                {isActive && isProcessing ? step.label + "..." : step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-12 mx-2 mb-5 transition-colors ${
                  i < activeIndex ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
