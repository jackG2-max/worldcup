import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign in · Grey World Cup Predictions",
};

export default function LoginPage() {
  return (
    <div className="mx-auto mt-10 max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">⚽ Grey World Cup</h1>
        <p className="mt-1 text-sm text-gray-500">
          Internal prediction league — sign in to play.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <LoginForm />
      </div>
    </div>
  );
}
