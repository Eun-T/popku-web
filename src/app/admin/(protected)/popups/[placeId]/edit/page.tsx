import PopupEdit from "./popup-edit";

export default async function PopupEditPage({ params }: { params: Promise<{ placeId: string }> }) {
  return <PopupEdit placeId={(await params).placeId} />;
}
