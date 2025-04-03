"use client"

import { useState } from "react"

type ToastVariant = "default" | "destructive" | "success"

type ToastProps = {
  title: string
  description: string
  variant?: ToastVariant
  duration?: number
  id?: string
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const toast = (props: ToastProps) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { ...props, id }
    
    setToasts((prevToasts) => [...prevToasts, newToast])

    // 自動削除のタイマー設定
    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
    }, props.duration || 5000)
    
    return id
  }

  const dismiss = (id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
  }

  return {
    toast,
    toasts,
    dismiss,
  }
}
