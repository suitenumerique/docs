export interface MermaidModule {
  initialize: (config: {
    startOnLoad: boolean;
    theme: string;
    securityLevel: string;
  }) => void;
  render: (id: string, text: string) => Promise<{ svg: string; }>;
}

export interface MermaidImport {
  default: MermaidModule;
}
