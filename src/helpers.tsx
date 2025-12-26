import React from 'react'

export const Button = ({ 
  children, 
  onClick, 
  className = '', 
  disabled = false,
  variant = 'default',
  ...props 
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  disabled?: boolean
  variant?: 'default' | 'primary' | 'danger'
  [key: string]: any
}) => {
  const baseClass = 'button'
  const variantClass = variant !== 'default' ? `button-${variant}` : ''
  
  return (
    <button
      className={`${baseClass} ${variantClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

export const Input = ({ 
  label, 
  id, 
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
  ...props 
}: {
  label?: string
  id?: string
  type?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
  [key: string]: any
}) => {
  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`form-input ${className}`}
        {...props}
      />
    </div>
  )
}

export const Select = ({ 
  label, 
  id, 
  value,
  onChange,
  children,
  className = '',
  ...props 
}: {
  label?: string
  id?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode
  className?: string
  [key: string]: any
}) => {
  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <select
        id={id}
        value={value}
        onChange={onChange}
        className={`form-input ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

export const LoadingSpinner = ({ message = 'Loading...' }: { message?: string }) => {
  return <div className="loading-message">{message}</div>
}

