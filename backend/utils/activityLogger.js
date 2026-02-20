import { createActivityLog } from "../models/ActivityLog.js";

export const logApplicationCreated = async (userId, application) => {
  const summary = `Added ${application.company} - ${application.role} to applications`;

  await createActivityLog({
    userId,
    entityType: "application",
    entityId: application._id,
    entityName: `${application.company} - ${application.role}`,
    action: "created",
    summary,
  });
};

export const logApplicationUpdated = async (
  userId,
  applicationId,
  entityName,
  oldData,
  newData,
) => {
  const changes = [];
  const changedFields = [];

  // Compare fields
  const fieldsToTrack = [
    "status",
    "company",
    "role",
    "notes",
    "source",
    "salaryRange",
  ];

  for (const field of fieldsToTrack) {
    if (field === "salaryRange") {
      if (JSON.stringify(oldData[field]) !== JSON.stringify(newData[field])) {
        changes.push({
          field,
          oldValue: oldData[field],
          newValue: newData[field],
        });
        changedFields.push("salary range");
      }
    } else if (oldData[field] !== newData[field]) {
      changes.push({
        field,
        oldValue: oldData[field],
        newValue: newData[field],
      });
      changedFields.push(field);
    }
  }

  if (changes.length === 0) return;

  // Generate summary
  let summary = "";
  if (changes.length === 1) {
    const change = changes[0];
    if (change.field === "status") {
      summary = `Status changed from ${change.oldValue} to ${change.newValue}`;
    } else {
      summary = `Updated ${change.field}`;
    }
  } else {
    summary = `Updated ${changedFields.join(", ")}`;
  }

  // Create one log entry per change
  for (const change of changes) {
    let changeSummary = summary;
    if (changes.length > 1 && change.field === "status") {
      changeSummary = `Status changed from ${change.oldValue} to ${change.newValue}`;
    }

    await createActivityLog({
      userId,
      entityType: "application",
      entityId: applicationId,
      entityName,
      action: "updated",
      changes: change,
      summary: changeSummary,
    });
  }
};

export const logApplicationDeleted = async (
  userId,
  applicationId,
  entityName,
) => {
  const summary = `Deleted ${entityName} application`;

  await createActivityLog({
    userId,
    entityType: "application",
    entityId: applicationId,
    entityName,
    action: "deleted",
    summary,
  });
};
