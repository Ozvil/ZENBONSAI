import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state = { error: null, info: null };
  }

  componentDidCatch(error, info){
    this.setState({ error, info });
    console.error("[AppErrorBoundary]", error, info);
  }

  render(){
    if (this.state.error){
      return (
        <div style={{padding:16, fontFamily:"system-ui, -apple-system, Segoe UI, Roboto"}}>
          <h2>Ocurrió un error en la app</h2>
          <p>{String(this.state.error?.message || this.state.error)}</p>
          {this.state.info?.componentStack && (
            <details style={{whiteSpace:"pre-wrap", marginTop:8}}>
              {this.state.info.componentStack}
            </details>
          )}
          <button
            style={{marginTop:12, padding:"8px 12px", cursor:"pointer"}}
            onClick={()=>location.reload()}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
