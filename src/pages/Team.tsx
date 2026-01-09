import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "../components/ui/table"
import { MoreHorizontal, Plus, Shield, UserCog } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"

const users = [
    { id: 1, name: "Alice Johnson", email: "alice@sonia.ai", role: "Admin", status: "Active", lastActive: "2 mins ago" },
    { id: 2, name: "Bob Smith", email: "bob@sonia.ai", role: "Editor", status: "Active", lastActive: "4 hours ago" },
    { id: 3, name: "Charlie Davis", email: "charlie@sonia.ai", role: "Viewer", status: "Inactive", lastActive: "2 days ago" },
    { id: 4, name: "Diana Prince", email: "diana@sonia.ai", role: "Editor", status: "Active", lastActive: "1 hour ago" },
    { id: 5, name: "Evan Wright", email: "evan@sonia.ai", role: "Viewer", status: "Active", lastActive: "5 mins ago" },
]

export function Team() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>Manage access and roles for your organization.</CardDescription>
                </div>
                <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Invite Member
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Active</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} />
                                            <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span>{user.name}</span>
                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {user.role === 'Admin' ? (
                                            <Shield className="h-3 w-3 text-primary" />
                                        ) : (
                                            <UserCog className="h-3 w-3 text-muted-foreground" />
                                        )}
                                        <span>{user.role}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={user.status === 'Active' ? 'outline' : 'secondary'} className={user.status === 'Active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : ""}>
                                        {user.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">{user.lastActive}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem>Edit Role</DropdownMenuItem>
                                            <DropdownMenuItem>Reset Password</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive">Remove User</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
