const PagePlaceholder = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
    <h1 className="text-4xl font-bold mb-4">{title}</h1>
    <p className="text-muted-foreground text-lg">This page is currently under construction in Phase 1.</p>
  </div>
);
const AskKaeo = () => <PagePlaceholder title="Ask Kaeo" />;
export default AskKaeo;
