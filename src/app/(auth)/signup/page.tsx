import AuthForm from "@/app/components/AuthForm";

export const metadata = { title: "Sign up – Realty Check" };

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h1>
        <p className="text-sm text-gray-500 mb-6">Start analyzing real estate investments</p>
        <AuthForm mode="signup" />
      </div>
    </main>
  );
}
