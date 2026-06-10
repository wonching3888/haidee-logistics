import { Card, CardContent } from "@/components/ui/card";

interface PlaceholderPageProps {
  title: string;
  titleEn: string;
  description: string;
}

export function PlaceholderPage({
  title,
  titleEn,
  description,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          {title} {titleEn}
        </h2>
        <p className="text-sm text-haidee-muted">{description}</p>
      </div>
      <Card className="border-haidee-border border-dashed">
        <CardContent className="flex min-h-[200px] items-center justify-center py-12 text-sm text-haidee-muted">
          此功能即将开发 — Coming soon
        </CardContent>
      </Card>
    </div>
  );
}
