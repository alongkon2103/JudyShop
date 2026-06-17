import { redirect } from "next/navigation";

export default function EditProductIndex({ params }: { params: { id: string } }) {
  redirect(`/admin/products/${params.id}/details`);
}
