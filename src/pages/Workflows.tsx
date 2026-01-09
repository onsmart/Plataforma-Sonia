import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { PlayCircle, GitBranch, CheckCircle2, Circle } from "lucide-react"

export function Workflows() {
    const steps = [
        { id: 1, title: "User Input", status: "completed", type: "trigger" },
        { id: 2, title: "Intent Classification", status: "completed", type: "process" },
        { id: 3, title: "Knowledge Retrieval", status: "active", type: "process" },
        { id: 4, title: "Response Generation", status: "pending", type: "process" },
        { id: 5, title: "Output Guardrails", status: "pending", type: "output" },
    ]

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">LangGraph Orchestration</h2>
                    <p className="text-muted-foreground">Visualize and manage complex agentic workflows.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">Load Template</Button>
                    <Button>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Test Workflow
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-12 flex-1">
                <Card className="md:col-span-8 relative overflow-hidden bg-muted/10 border-dashed border-2 flex items-center justify-center min-h-[400px]">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    
                    {/* Simulated Flow Graph */}
                    <div className="relative z-10 flex items-center gap-8">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <div className={`
                                    w-48 p-4 rounded-xl border shadow-sm flex flex-col gap-2
                                    ${step.status === 'completed' ? 'bg-card border-emerald-500/20' : 
                                      step.status === 'active' ? 'bg-card border-primary ring-2 ring-primary/20' : 
                                      'bg-muted/40 border-transparent opacity-60'}
                                `}>
                                    <div className="flex justify-between items-center">
                                        <Badge variant="outline" className="text-[10px] uppercase">{step.type}</Badge>
                                        {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                        {step.status === 'active' && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                                        {step.status === 'pending' && <Circle className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                    <span className="font-medium text-sm">{step.title}</span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className="h-[2px] w-12 bg-border mx-2 relative">
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1 border-t-2 border-r-2 border-border w-2 h-2 rotate-45"></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="md:col-span-4 flex flex-col">
                    <CardHeader>
                        <CardTitle>Step Details</CardTitle>
                        <CardDescription>Configuration for "Knowledge Retrieval"</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Vector Database</label>
                            <div className="p-2 bg-muted/50 rounded text-sm font-mono">pinecone-index-v1</div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Embedding Model</label>
                            <div className="p-2 bg-muted/50 rounded text-sm font-mono">text-embedding-3-small</div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Top K</label>
                            <div className="p-2 bg-muted/50 rounded text-sm font-mono">5</div>
                        </div>
                        <div className="pt-4 border-t">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <GitBranch className="h-4 w-4" />
                                <span>Connected to 3 downstream nodes</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
