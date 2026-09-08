import { Component, type ErrorInfo, type ReactNode } from 'react'
import ErrorPage from '../pages/error page/ErrorPage'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  public handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  public render() {
    if (this.state.hasError) {
      const details = this.state.error
        ? `${this.state.error.toString()}\n${this.state.errorInfo?.componentStack || ''}`
        : undefined

      return (
        <ErrorPage
          code={500}
          title="Application Error"
          message="An unexpected client-side error occurred. We've captured the error and you can safely return to your dashboard or retry."
          details={details}
          onRetry={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
