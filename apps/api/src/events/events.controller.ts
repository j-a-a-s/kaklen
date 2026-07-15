import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationAccessGuard } from "../organizations/organization-access.guard";
import type { OrganizationRequest } from "../organizations/organization.types";
import { RequirePermissions } from "../organizations/require-permissions.decorator";
import {
  CalendarEventsQueryDto,
  ChangeEventStatusDto,
  CreateEventDto,
  EventParticipantDto,
  EventResourceDto,
  EventTaskDto,
  EventTimelineEntryDto,
  ListEventsQueryDto,
  UpdateEventDto
} from "./dto/event.dto";
import { EventsService, EventSummary, PaginatedEvents } from "./events.service";

@ApiTags("events")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Controller("organizations/:organizationId")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post("events")
  @RequirePermissions("events.create")
  @ApiOperation({ summary: "Create event", description: "Requires events.create." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiCreatedResponse()
  create(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: CreateEventDto
  ) {
    return this.eventsService.create(organizationId, request.user.sub, dto);
  }

  @Post("quotations/:quotationId/create-event")
  @RequirePermissions("events.create")
  @ApiOperation({ summary: "Create event from approved quotation", description: "Requires events.create." })
  @ApiCreatedResponse()
  createFromQuotation(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: CreateEventDto
  ) {
    return this.eventsService.createFromQuotation(organizationId, quotationId, request.user.sub, dto);
  }

  @Get("events")
  @RequirePermissions("events.read")
  @ApiOperation({ summary: "List events", description: "Requires events.read. Supports filters, sorting and pagination." })
  @ApiOkResponse()
  list(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Query() query: ListEventsQueryDto
  ): Promise<PaginatedEvents> {
    return this.eventsService.list(organizationId, query);
  }

  @Get("events/summary")
  @RequirePermissions("events.read")
  @ApiOperation({ summary: "Event summary", description: "Requires events.read." })
  @ApiOkResponse()
  summary(@Param("organizationId", new ParseUUIDPipe()) organizationId: string): Promise<EventSummary> {
    return this.eventsService.summary(organizationId);
  }

  @Get("events/calendar")
  @RequirePermissions("events.read")
  @ApiOperation({ summary: "Calendar events", description: "Requires events.read. from and to are mandatory." })
  @ApiOkResponse()
  calendar(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Query() query: CalendarEventsQueryDto
  ) {
    return this.eventsService.calendar(organizationId, query);
  }

  @Get("events/:eventId")
  @RequirePermissions("events.read")
  @ApiOkResponse()
  get(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("eventId", new ParseUUIDPipe()) eventId: string
  ) {
    return this.eventsService.get(organizationId, eventId);
  }

  @Patch("events/:eventId")
  @RequirePermissions("events.update")
  @ApiOperation({ summary: "Update event", description: "Requires events.update. Completed and archived events are locked." })
  @ApiOkResponse()
  update(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: UpdateEventDto
  ) {
    return this.eventsService.update(organizationId, eventId, request.user.sub, dto);
  }

  @Delete("events/:eventId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("events.delete")
  @ApiNoContentResponse()
  archive(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @Req() request: OrganizationRequest
  ): Promise<void> {
    return this.eventsService.archive(organizationId, eventId, request.user.sub);
  }

  @Post("events/:eventId/confirm")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("events.manage")
  @ApiOkResponse()
  confirm(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Req() request: OrganizationRequest, @Body() _dto: ChangeEventStatusDto) {
    return this.eventsService.confirm(organizationId, eventId, request.user.sub);
  }

  @Post("events/:eventId/start")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("events.manage")
  @ApiOkResponse()
  start(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Req() request: OrganizationRequest, @Body() _dto: ChangeEventStatusDto) {
    return this.eventsService.start(organizationId, eventId, request.user.sub);
  }

  @Post("events/:eventId/complete")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("events.manage")
  @ApiOkResponse()
  complete(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Req() request: OrganizationRequest, @Body() _dto: ChangeEventStatusDto) {
    return this.eventsService.complete(organizationId, eventId, request.user.sub);
  }

  @Post("events/:eventId/cancel")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("events.manage")
  @ApiOkResponse()
  cancel(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Req() request: OrganizationRequest, @Body() _dto: ChangeEventStatusDto) {
    return this.eventsService.cancel(organizationId, eventId, request.user.sub);
  }

  @Post("events/:eventId/tasks")
  @RequirePermissions("events.update")
  @ApiCreatedResponse()
  createTask(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Req() request: OrganizationRequest, @Body() dto: EventTaskDto) {
    return this.eventsService.createTask(organizationId, eventId, request.user.sub, dto);
  }

  @Get("events/:eventId/tasks")
  @RequirePermissions("events.read")
  @ApiOkResponse()
  listTasks(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string) {
    return this.eventsService.listTasks(organizationId, eventId);
  }

  @Patch("events/:eventId/tasks/:taskId")
  @RequirePermissions("events.update")
  @ApiOkResponse()
  updateTask(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Param("taskId", new ParseUUIDPipe()) taskId: string, @Req() request: OrganizationRequest, @Body() dto: EventTaskDto) {
    return this.eventsService.updateTask(organizationId, eventId, taskId, request.user.sub, dto);
  }

  @Delete("events/:eventId/tasks/:taskId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("events.update")
  @ApiNoContentResponse()
  deleteTask(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Param("taskId", new ParseUUIDPipe()) taskId: string): Promise<void> {
    return this.eventsService.deleteTask(organizationId, eventId, taskId);
  }

  @Post("events/:eventId/participants")
  @RequirePermissions("events.update")
  @ApiCreatedResponse()
  createParticipant(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Body() dto: EventParticipantDto) {
    return this.eventsService.createParticipant(organizationId, eventId, dto);
  }

  @Get("events/:eventId/participants")
  @RequirePermissions("events.read")
  @ApiOkResponse()
  listParticipants(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string) {
    return this.eventsService.listParticipants(organizationId, eventId);
  }

  @Delete("events/:eventId/participants/:participantId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("events.update")
  @ApiNoContentResponse()
  deleteParticipant(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Param("participantId", new ParseUUIDPipe()) participantId: string): Promise<void> {
    return this.eventsService.deleteParticipant(organizationId, eventId, participantId);
  }

  @Post("events/:eventId/resources")
  @RequirePermissions("events.update")
  @ApiCreatedResponse()
  createResource(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Body() dto: EventResourceDto) {
    return this.eventsService.createResource(organizationId, eventId, dto);
  }

  @Get("events/:eventId/resources")
  @RequirePermissions("events.read")
  @ApiOkResponse()
  listResources(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string) {
    return this.eventsService.listResources(organizationId, eventId);
  }

  @Patch("events/:eventId/resources/:resourceId")
  @RequirePermissions("events.update")
  @ApiOkResponse()
  updateResource(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Param("resourceId", new ParseUUIDPipe()) resourceId: string, @Body() dto: EventResourceDto) {
    return this.eventsService.updateResource(organizationId, eventId, resourceId, dto);
  }

  @Delete("events/:eventId/resources/:resourceId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("events.update")
  @ApiNoContentResponse()
  deleteResource(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Param("resourceId", new ParseUUIDPipe()) resourceId: string): Promise<void> {
    return this.eventsService.deleteResource(organizationId, eventId, resourceId);
  }

  @Post("events/:eventId/timeline")
  @RequirePermissions("events.update")
  @ApiCreatedResponse()
  createTimelineEntry(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Body() dto: EventTimelineEntryDto) {
    return this.eventsService.createTimelineEntry(organizationId, eventId, dto);
  }

  @Get("events/:eventId/timeline")
  @RequirePermissions("events.read")
  @ApiOkResponse()
  listTimeline(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string) {
    return this.eventsService.listTimeline(organizationId, eventId);
  }

  @Patch("events/:eventId/timeline/:entryId")
  @RequirePermissions("events.update")
  @ApiOkResponse()
  updateTimelineEntry(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Param("entryId", new ParseUUIDPipe()) entryId: string, @Body() dto: EventTimelineEntryDto) {
    return this.eventsService.updateTimelineEntry(organizationId, eventId, entryId, dto);
  }

  @Delete("events/:eventId/timeline/:entryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("events.update")
  @ApiNoContentResponse()
  deleteTimelineEntry(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("eventId", new ParseUUIDPipe()) eventId: string, @Param("entryId", new ParseUUIDPipe()) entryId: string): Promise<void> {
    return this.eventsService.deleteTimelineEntry(organizationId, eventId, entryId);
  }
}
