import { SimpleChange } from "@angular/core";
import { QuotationEmailDialogComponent } from "./quotation-email-dialog.component";

describe("QuotationEmailDialogComponent", () => {
  let component: QuotationEmailDialogComponent;

  beforeEach(() => {
    component = new QuotationEmailDialogComponent();
    component.open = true;
    component.recipient = "client@example.com";
    component.quotationNumber = "QUO-000001 v1";
    component.locale = "en";
    component.ngOnChanges({ open: new SimpleChange(false, true, true) });
  });

  afterEach(() => component.ngOnDestroy());

  it("preloads the client recipient and localized document context", () => {
    expect(component.form.controls.to.value).toBe("client@example.com");
    expect(component.form.controls.subject.value).toContain("QUO-000001 v1");
    expect(component.form.controls.message.value.length).toBeGreaterThan(0);
  });

  it("rejects invalid recipients and emits normalized valid payloads", () => {
    const emit = spyOn(component.sendRequested, "emit");
    component.form.controls.to.setValue("invalid");
    component.submit();
    expect(emit).not.toHaveBeenCalled();

    component.form.controls.to.setValue(" Client@Example.COM ");
    component.submit();
    expect(emit).toHaveBeenCalledWith(jasmine.objectContaining({ to: "client@example.com", locale: "en" }));
  });

  it("prevents duplicate submission while busy", () => {
    const emit = spyOn(component.sendRequested, "emit");
    component.busy = true;
    component.submit();
    expect(emit).not.toHaveBeenCalled();
  });
});
