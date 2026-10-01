import PopupImages from "./popup-images";

export default async function PopupImagesPage({ params }: { params: Promise<{ placeId: string }> }) {
  return <PopupImages placeId={(await params).placeId} />;
}
