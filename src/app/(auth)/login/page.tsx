import AuthForm from "@/app/components/AuthForm";

export const metadata = { title: "Sign in – Realty Check" };

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in</h1>
        <p className="text-sm text-gray-500 mb-6">Welcome back to Realty Check</p>
        <AuthForm mode="signin" />
      </div>
    </main>
  );
}
