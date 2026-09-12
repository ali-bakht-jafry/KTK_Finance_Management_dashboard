import Link from "next/link";
import { Plus, Building2, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { getFloorOccupancy } from "@/lib/aggregates";
import { formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FloorForm } from "@/components/floors/floor-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteFloor } from "@/lib/actions/floors";

export default async function FloorsPage() {
  const user = await requireUser();
  const floors = await getFloorOccupancy();
  const canManage = can(user.role, PERMISSIONS.manageStructure);

  const suggestedOrder = floors.reduce((max, f) => Math.max(max, f.order), 0) + 1;

  return (
    <div>
      <PageHeader
        title="Floors"
        description="Manage the hostel's floors and see occupancy at a glance."
        actions={
          canManage ? (
            <FloorForm suggestedOrder={suggestedOrder} trigger={<Button><Plus />Add Floor</Button>} />
          ) : undefined
        }
      />

      {floors.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No floors yet"
          description="Add your first floor to start building the hostel structure."
          action={
            canManage ? (
              <FloorForm suggestedOrder={1} trigger={<Button><Plus />Add Floor</Button>} />
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Floor</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Rooms</TableHead>
                  <TableHead className="text-right">Seats</TableHead>
                  <TableHead className="text-right">Occupied</TableHead>
                  <TableHead className="text-right">Vacant</TableHead>
                  <TableHead className="w-40">Occupancy</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {floors.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <Link href={`/floors/${f.id}`} className="hover:underline">
                        {f.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.order}</TableCell>
                    <TableCell className="text-right">{f.rooms}</TableCell>
                    <TableCell className="text-right">{f.total}</TableCell>
                    <TableCell className="text-right">{f.occupied}</TableCell>
                    <TableCell className="text-right">{f.vacant}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={f.pct * 100} className="flex-1" />
                        <span className="w-12 text-right text-xs text-muted-foreground">
                          {formatPercent(f.pct)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/floors/${f.id}`}>
                            Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        {canManage && (
                          <>
                            <FloorForm
                              floor={{ id: f.id, name: f.name, order: f.order }}
                              trigger={<Button variant="ghost" size="sm">Edit</Button>}
                            />
                            <ConfirmButton
                              action={deleteFloor}
                              id={f.id}
                              title="Delete floor"
                              description={`Delete "${f.name}"? Any rooms with no residents will also be removed. This cannot be undone.`}
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
