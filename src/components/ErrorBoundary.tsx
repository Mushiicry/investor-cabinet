import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

/**
 * Ловит рантайм-ошибки рендера, чтобы приложение не превращалось в белый экран.
 * Данные не изменяются — только UI. Логируем в консоль (dev-friendly).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("UI ERROR BOUNDARY", error, info.componentStack);
  }

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="v2-errboundary">
        <div className="v2-errboundary-card">
          <div className="v2-errboundary-icon" aria-hidden="true">⚠</div>
          <h2 className="v2-errboundary-title">Интерфейс временно не загрузился</h2>
          <p className="v2-errboundary-text">
            Данные не изменялись — это сбой отображения. Обнови страницу.
          </p>
          <button className="v2-errboundary-btn" type="button" onClick={this.handleReload}>
            Обновить страницу
          </button>
          {this.state.message && (
            <code className="v2-errboundary-detail">{this.state.message}</code>
          )}
        </div>
      </div>
    );
  }
}
