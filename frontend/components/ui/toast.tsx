"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function ToastContainer() {
  const { toasts, dismiss } = useToast()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed bottom-0 right-0 p-4 w-full sm:max-w-sm z-50">
      <div className="flex flex-col space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-lg shadow-lg transition-all duration-300 animate-slide-in-right
              ${
                toast.variant === "destructive"
                  ? "bg-red-600 text-white"
                  : toast.variant === "success"
                  ? "bg-green-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
              }
            `}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{toast.title}</h3>
                <p className="text-sm mt-1 opacity-90">{toast.description}</p>
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="ml-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
