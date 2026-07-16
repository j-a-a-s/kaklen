#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const directory = new URL("../apps/web/src/locale/", import.meta.url);
const sourceUnits = parseUnits(readFileSync(new URL("messages.xlf", directory), "utf8"), false);

const translations = {
  en: {
    changeEmailAction: "Change email",
    openResendVerificationPage: "Use a different email",
    verificationResentMessage: "If your account is still pending, we sent a new confirmation email.",
    verificationResendError: "We could not request another email. Try again.",
    verificationResendingLabel: "Sending...",
    resendVerificationAction: "Resend confirmation email",
    emailNotVerifiedMessage: "Your email has not been confirmed yet.",
    accountCreatedEyebrow: "Account created",
    registerCheckEmailTitle: "Check your email",
    registerCheckEmailDescription: "We created your account, but you must confirm your email address before signing in.",
    openLoginAction: "Open sign in",
    changeRegistrationEmailAction: "Change email",
    verificationBrandPromise: "Confirm your identity to protect your account.",
    resendVerificationEyebrow: "Account confirmation",
    resendVerificationTitle: "Resend confirmation email",
    resendVerificationDescription: "Enter your email. If the account is still pending, we will send a new link.",
    verificationRequestReceivedEyebrow: "Request received",
    resendVerificationSuccess: "If the account requires confirmation, you will receive a new link.",
    emailVerificationEyebrow: "Email confirmation",
    requestNewVerificationAction: "Request a new email",
    verifyingEmailTitle: "Confirming your email",
    emailConfirmedTitle: "Email confirmed",
    verificationExpiredTitle: "Link expired",
    verificationUsedTitle: "Link already used",
    verificationInvalidTitle: "Invalid link",
    verificationNetworkTitle: "We could not confirm your email",
    verifyingEmailDescription: "We are validating your confirmation link.",
    emailConfirmedDescription: "Your email was confirmed successfully. You can now sign in.",
    verificationExpiredDescription: "This link has expired. Request a new confirmation email.",
    verificationUsedDescription: "This link has already been used. You can sign in or request a new one.",
    verificationInvalidDescription: "This link is not valid. Request a new confirmation email.",
    verificationNetworkDescription: "Check your connection and try opening the link again.",
    recoveryBrandPromise: "Recover access securely.",
    forgotPasswordEyebrow: "Account recovery",
    forgotPasswordTitle: "Recover your account",
    forgotPasswordDescription: "Enter the email associated with your account. If it exists, we will send you instructions.",
    backToLogin: "Back to sign in",
    forgotPasswordSentEyebrow: "Instructions sent",
    checkYourEmailTitle: "Check your email",
    checkYourEmailDescription: "If an account is associated with that email, you will receive a link valid for 30 minutes.",
    sendingInstructionsLabel: "Sending...",
    sendInstructionsLabel: "Send instructions",
    recoveryServerTimeout: "The server is taking too long to respond.",
    recoveryServerUnavailable: "We could not connect to the server. Try again.",
    recoveryRequestFailed: "We could not send the instructions. Try again.",
    forgotPasswordLink: "Forgot your password?",
    resetBrandPromise: "Protect your account with a new password.",
    resetPasswordEyebrow: "Account recovery",
    resetPasswordTitle: "Create a new password",
    resetPasswordDescription: "Choose a password that is different from the one you used before.",
    newPasswordLabel: "New password",
    passwordStrengthLabel: "Strength",
    passwordRequirements: "Use at least 10 characters and avoid your name, email, or previous password.",
    confirmNewPasswordLabel: "Confirm password",
    passwordConfirmationValidation: "Passwords must match.",
    resetCompleteEyebrow: "Access recovered",
    passwordUpdatedTitle: "Password updated",
    passwordUpdatedDescription: "You can now sign in with your new password.",
    signInAction: "Sign in",
    expiredTokenTitle: "Link expired",
    expiredTokenMessage: "This link has expired. Request a new one.",
    requestAnotherLink: "Request another link",
    usedTokenTitle: "Link already used",
    usedTokenMessage: "This link has already been used. You can sign in or request another one.",
    networkErrorTitle: "Cannot reach the server",
    tryAgainAction: "Try again",
    passwordStrengthWeak: "Weak",
    passwordStrengthAcceptable: "Acceptable",
    passwordStrengthStrong: "Strong",
    hidePasswordAction: "Hide",
    showPasswordAction: "Show",
    resettingPasswordLabel: "Updating...",
    resetPasswordAction: "Reset password",
    missingTokenTitle: "Recovery link is incomplete",
    invalidTokenTitle: "Invalid link",
    missingTokenMessage: "Open the complete link you received by email.",
    invalidTokenMessage: "This link is not valid.",
    passwordReuseError: "Choose a password that is different from your previous one.",
    passwordPolicyError: "The password does not meet the security requirements.",
    passwordResetRateLimit: "Too many attempts. Wait a few minutes.",
    passwordResetFailed: "We could not update the password. Try again.",
    loginRateLimit: "Too many sign-in attempts. Wait a minute and try again.",
    passwordValidation: "The password must be at least 10 characters long.",
    loginSwitch: "Don’t have an account? <x id=\"START_LINK\" ctype=\"x-a\" equiv-text=\"&lt;a routerLink=&quot;/register&quot;&gt;\"/>Create one<x id=\"CLOSE_LINK\" ctype=\"x-a\" equiv-text=\"&lt;/a&gt;\"/>",
    registerSwitch: "Already have an account? <x id=\"START_LINK\" ctype=\"x-a\" equiv-text=\"&lt;a routerLink=&quot;/login&quot;&gt;\"/>Sign in<x id=\"CLOSE_LINK\" ctype=\"x-a\" equiv-text=\"&lt;/a&gt;\"/>",
    clientHistoryEyebrow: "Client relationship", clientTimelineTitle: "Timeline", clientTimelineAriaLabel: "Client timeline", openResourceAction: "Open", emptyClientTimeline: "Client activity will appear here when you record interactions, quotations, or events.",
    timelineClientCreated: "Client created", timelineClientUpdated: "Client details updated", timelineClientArchived: "Client archived", timelineNote: "Note recorded", timelineCall: "Call recorded", timelineEmail: "Email recorded", timelineMeeting: "Meeting recorded", timelineWhatsapp: "WhatsApp conversation", timelineQuotationCreated: "Quotation created", timelineQuotationSent: "Quotation sent", timelineQuotationApproved: "Quotation approved", timelineQuotationRejected: "Quotation rejected", timelineQuotationCancelled: "Quotation cancelled", timelineEventCreated: "Event created", timelineEventCompleted: "Event completed", timelineEventCancelled: "Event cancelled", timelineResourceUpdated: "Activity updated",
    clientProgressLabel: "Client progress", clientStepIdentity: "Type and identification", clientStepContact: "Contact details", clientStepAddress: "Address", clientStepReview: "Review", clientReviewHelp: "Confirm the main information. You can complete or edit the details later.", saveBasicClientButton: "Save basic details", clientStepSingleValidationError: "Complete or correct 1 field in this step.", clientStepValidationError: "Complete or correct {$fieldCount} fields in this step.",
    upcomingEventsMetric: "upcoming events", expiringQuotationsMetric: "quotations expiring soon", urgentTasksMetric: "priority tasks", clientsWithoutFollowUpMetric: "clients to contact", hideOnboardingButton: "Hide for now", showOnboardingButton: "View getting started guide", todayAttentionEyebrow: "Needs attention", todayAttentionTitle: "Operational priorities", validUntilShortLabel: "Expires", noUrgentWork: "There are no urgent tasks or quotations awaiting a response.", upcomingEyebrow: "Coming up", upcomingEventsTitle: "Events on your schedule", viewAllLink: "View all", noUpcomingEvents: "There are no upcoming events yet. Create one to organize dates, tasks, and resources.", organizationActivityEyebrow: "Team work", recentActivityTitle: "Recent activity", onboardingDescription: "Complete these steps to move from your first records to an operation ready for work.",
    guidedOrganizationTitle: "Configure your organization", guidedOrganizationDescription: "Define identity, country, currency, and time zone.", configureAction: "Configure", guidedClientTitle: "Create your first client", guidedClientDescription: "Register the person or company you will work with.", guidedCatalogTitle: "Add products or services", guidedCatalogDescription: "Save prices and units so you can quote without repeating work.", guidedQuotationTitle: "Create and send a quotation", guidedQuotationDescription: "Turn the client's needs into a clear proposal.", guidedApprovalTitle: "Record the approval", guidedApprovalDescription: "Confirm the proposal that will become operational work.", viewQuotationsAction: "View quotations", guidedEventTitle: "Create your first event", guidedEventDescription: "Organize dates, team members, tasks, and resources.",
    recommendedOrganizationTitle: "Complete your organization settings", recommendedOrganizationDescription: "Regional information ensures dates, currency, and taxes are used correctly.", recommendedSendQuotationTitle: "Send your first quotation", recommendedSendQuotationDescription: "Share it with the client to start commercial follow-up.", recommendedApprovalTitle: "Record the first approval", recommendedApprovalDescription: "An approved proposal can be turned directly into an event.", recommendedEventTitle: "Create your first event", recommendedEventDescription: "Organize the delivery of an approved quotation or manual job.", recommendedExpiringTitle: "Follow up on a quotation that is expiring", recommendedExpiringDescription: "A timely response keeps the opportunity alive.", openQuotationAction: "Open quotation", recommendedUpcomingEventTitle: "Review your next event", recommendedUpcomingEventDescription: "Confirm tasks, participants, and resources before it starts.", openEventAction: "Open event", recommendedUrgentTaskTitle: "Resolve a priority task", recommendedUrgentTaskDescription: "Handling it now reduces event risk.", reviewTaskAction: "Review task", recommendedFollowUpTitle: "Reconnect with a client", recommendedFollowUpDescription: "A brief follow-up can open a new opportunity.", openClientAction: "Open client", recommendedOpportunityTitle: "Create a new opportunity", recommendedOpportunityDescription: "Your operation is up to date. Prepare the next commercial proposal.",
    eventProgressLabel: "Event progress", eventStepMain: "Main information", eventStepMainHelp: "Choose whether to start from an approved quotation or from scratch.", eventSourceLabel: "Event source", eventFromQuotationTitle: "From an approved quotation", eventFromQuotationHelp: "Reuse the client, budget, and commercial context.", manualEventTitle: "Manual event", manualEventHelp: "Start with basic information and complete it later.", selectQuotationOption: "Select a quotation", eventNameExample: "E.g. Seasonal launch", eventDescriptionExample: "Main objective and scope", eventStepDateLocation: "Date and location", eventStepDateLocationHelp: "Define when and where the work will take place.", venueExample: "E.g. Event venue", eventStepTeamResources: "Team and resources", eventStepTeamResourcesHelp: "These details are optional. You can add more participants and resources from the event.", initialParticipantLabel: "Initial participant", participantNameExample: "Participant name", initialResourceLabel: "Initial resource", resourceNameExample: "E.g. Sound equipment", resourceQuantityLabel: "Resource quantity", eventStepTasks: "Initial tasks", eventStepTasksHelp: "You can save without tasks and add them when you plan the delivery.", initialTaskLabel: "First task", initialTaskExample: "E.g. Confirm suppliers", priorityLow: "Low", priorityMedium: "Medium", priorityHigh: "High", priorityUrgent: "Urgent", eventStepReview: "Review", eventStepReviewHelp: "Confirm the information. The event will be saved as a draft so you can keep planning.", afterEventCreationTitle: "After creating it", afterEventCreationHelp: "You can add more tasks, assign participants, and confirm the event from its details.", createEventDraftButton: "Create draft event", createFromQuotationConfirmTitle: "Create event from this quotation", createFromQuotationConfirmDescription: "Kaklen will reuse the client, budget, and context from the approved quotation. Only one event can be linked to it.", createEventConfirmButton: "Create event", eventForQuotationPrefix: "Event", eventStepSingleValidationError: "Complete or correct 1 field in this step.", eventStepValidationError: "Complete or correct {$fieldCount} fields in this step.", eventOptionalSetupWarning: "The event was created, but some optional details could not be added. You can complete them from the event details.",
    inviteFirstMemberAction: "Invite the first member", membersEmptyTitle: "Your team starts with you", membersEmptyDescription: "Invite people to share tasks and keep permissions clear within the organization.", searchClientLabel: "Search clients", searchClientPlaceholder: "Name, email, or tax ID", createClientNewTabAction: "Create client in a new tab", refreshClientsAction: "Refresh clients", searchCatalogLabel: "Search catalog", searchCatalogPlaceholder: "Name, code, or SKU", duplicateLineButton: "Duplicate line", termsExample: "Payment method, deadlines, and conditions", quotationNotesExample: "Useful information for the client", quotationVerificationNote: "Kaklen will automatically calculate and verify the totals when saving.", clientSummaryFallback: "Client registered without contact details", globalDiscountLabel: "Overall discount (%)", globalDiscountHelp: "Applies to lines that do not have a specific discount.",
    commandPaletteEyebrow: "Action center", globalSearchLabel: "Search clients, catalog, quotations, and events", commandSearchPlaceholder: "Search or type an action", searchingLabel: "Searching...", searchMinimumHelp: "Enter at least 2 characters.", recentActionsTitle: "Recent", commandActionsTitle: "Create and manage", commandNavigationTitle: "Navigation", noSearchResultsTitle: "No matches found.", noSearchResultsHelp: "Try a different name, code, or number.", commandNavigateHelp: "to navigate", commandOpenHelp: "to open", commandCloseHelp: "to close", membersCommandHelp: "Manage team and roles", settingsCommandHelp: "Configure your organization", globalSearchError: "We could not complete the search. Try again.", errorRutRequired: "A RUT is required for Chilean companies.", noRecentActivity: "Activity will appear here when your team starts working.",
    activityClientCreated: "created client", activityClientUpdated: "updated client", activityCatalogCreated: "added to the catalog", activityCatalogUpdated: "updated", activityQuotationCreated: "created quotation", activityQuotationSent: "sent quotation", activityQuotationApproved: "approved quotation", activityQuotationRejected: "rejected quotation", activityEventCreated: "created event", activityEventCompleted: "completed event", activityOrganizationUpdated: "updated the organization", activityUpdated: "updated",
    clientsEmptyTitle: "You do not have clients yet", clientsEmpty: "Create the first one to prepare quotations, record conversations, and organize events.", catalogEmptyTitle: "Add your products and services", catalogEmpty: "Save prices, units, and taxes to prepare quotations faster.", quotationsEmptyTitle: "Create your first quotation", quotationsEmpty: "Prepare a proposal and turn it into an event when the client approves it.", eventsEmptyTitle: "Organize your first event", eventsEmpty: "Create one manually or start from an approved quotation to coordinate tasks and resources.", quotationFormDescription: "Kaklen will automatically calculate and verify the totals when saving.",
    quotationCancelledLabel: "Cancelled", eventCompletedLabel: "Completed", eventCancelledLabel: "Cancelled", taskCompletedLabel: "Completed", taskCancelledLabel: "Cancelled", archiveCatalogDetailDialogTitle: "Archive item", archiveCatalogDetailDialogDescription: "The item will no longer be available for new operations, but its historical information will be preserved.", cityOrCommuneLabel: "City or district", onboardingCompletedLabel: "Completed",
    openWeeklyEventAriaLabel: "Open event {$eventName}, {$eventDate} at {$eventTime}", participantIdentityRequired: "Enter the participant's name or email.", eventDateValidation: "The end date must be after the start date.", quantityValidation: "Quantity must be greater than 0 and have no more than 3 decimal places.", budgetValidation: "Budget must be 0 or greater and have no more than 2 decimal places.", eventConfirmedPluralLabel: "Confirmed", eventCompletedPluralLabel: "Completed", eventCancelledPluralLabel: "Cancelled",
    sendQuotationEmailTitle: "Send by email", resendQuotationEmailButton: "Resend by email", discountsTotalLabel: "Discounts", taxesTotalLabel: "Taxes", preparingPdfMessage: "Preparing PDF...", preparingPdfNotification: "We are preparing your PDF.", pdfDownloadedSuccess: "Quotation downloaded.", pdfDownloadError: "We could not generate the PDF. Try again.", quotationEmailSentSuccess: "Quotation sent by email.", quotationEmailSendError: "We could not send the email. The quotation status was not changed.",
    approveQuotationDialogTitle: "Approve quotation", rejectQuotationDialogTitle: "Reject quotation", approveQuotationDialogDescription: "The quotation will be approved and can be used to create an event.", rejectQuotationDialogDescription: "The quotation will be rejected and this decision will be recorded in its history.", historyQuotationEmailed: "Quotation sent by email", historyQuotationVersionCreated: "New version created", historyQuotationCreated: "Quotation created", historyQuotationSent: "Quotation sent", historyQuotationApproved: "Quotation approved", historyQuotationRejected: "Quotation rejected", historyQuotationCancelled: "Quotation cancelled", historyQuotationUpdated: "Quotation updated", historyQuotationEmailedDescription: "Sent by email to {$recipient}", systemActorLabel: "System",
    moneyValidation: "Enter an amount of 0 or greater with no more than 2 decimal places.", discountValidation: "A percentage discount must be between 0 and 100.", quotationDateValidation: "The valid-until date must be on or after the issue date.", itemsLabel: "Items", quotationStepSingleValidationError: "Complete or correct 1 field in this step.", quotationStepValidationError: "Complete or correct {$fieldCount} fields in this step.", quotationDraftPluralLabel: "Drafts", quotationSentPluralLabel: "Sent", quotationApprovedPluralLabel: "Approved",
    sendQuotationEmailEyebrow: "Quotation email", recipientEmailLabel: "Recipient", messageLabel: "Message", quotationPdfAttachmentHelp: "The updated quotation PDF will be attached automatically.", sendEmailButton: "Send email", sendingEmailButton: "Sending...", quotationEmailDefaultSubject: "Quotation {$quotationNumber}", quotationEmailDefaultMessage: "Our commercial proposal is attached for your review.",
    fieldRequiredError: "This field is required.", fieldInvalidError: "Review the value entered.", phoneValidation: "Enter a valid phone number with country code, for example +56 9 1234 5678.", dateOrderValidation: "The end date must be on or after the start date.", singleFieldMissingError: "Complete or correct 1 field.", multipleFieldsMissingError: "Complete or correct {$fieldCount} fields."
  },
  "pt-BR": {
    changeEmailAction: "Alterar e-mail",
    openResendVerificationPage: "Usar outro e-mail",
    verificationResentMessage: "Se sua conta ainda estiver pendente, enviamos um novo e-mail de confirmação.",
    verificationResendError: "Não foi possível solicitar outro e-mail. Tente novamente.",
    verificationResendingLabel: "Enviando...",
    resendVerificationAction: "Reenviar e-mail de confirmação",
    emailNotVerifiedMessage: "Seu e-mail ainda não foi confirmado.",
    accountCreatedEyebrow: "Conta criada",
    registerCheckEmailTitle: "Verifique seu e-mail",
    registerCheckEmailDescription: "Criamos sua conta, mas você precisa confirmar seu endereço de e-mail antes de entrar.",
    openLoginAction: "Abrir tela de acesso",
    changeRegistrationEmailAction: "Alterar e-mail",
    verificationBrandPromise: "Confirme sua identidade para proteger sua conta.",
    resendVerificationEyebrow: "Confirmação da conta",
    resendVerificationTitle: "Reenviar e-mail de confirmação",
    resendVerificationDescription: "Digite seu e-mail. Se a conta ainda estiver pendente, enviaremos um novo link.",
    verificationRequestReceivedEyebrow: "Solicitação recebida",
    resendVerificationSuccess: "Se a conta precisar de confirmação, você receberá um novo link.",
    emailVerificationEyebrow: "Confirmação de e-mail",
    requestNewVerificationAction: "Solicitar um novo e-mail",
    verifyingEmailTitle: "Confirmando seu e-mail",
    emailConfirmedTitle: "E-mail confirmado",
    verificationExpiredTitle: "Link expirado",
    verificationUsedTitle: "Link já utilizado",
    verificationInvalidTitle: "Link inválido",
    verificationNetworkTitle: "Não foi possível confirmar seu e-mail",
    verifyingEmailDescription: "Estamos validando seu link de confirmação.",
    emailConfirmedDescription: "Seu e-mail foi confirmado. Agora você já pode entrar.",
    verificationExpiredDescription: "Este link expirou. Solicite um novo e-mail de confirmação.",
    verificationUsedDescription: "Este link já foi utilizado. Você pode entrar ou solicitar um novo.",
    verificationInvalidDescription: "Este link não é válido. Solicite um novo e-mail de confirmação.",
    verificationNetworkDescription: "Verifique sua conexão e tente abrir o link novamente.",
    recoveryBrandPromise: "Recupere o acesso com segurança.",
    forgotPasswordEyebrow: "Recuperação de acesso",
    forgotPasswordTitle: "Recupere sua conta",
    forgotPasswordDescription: "Digite o e-mail associado à sua conta. Se ela existir, enviaremos as instruções.",
    backToLogin: "Voltar para entrar",
    forgotPasswordSentEyebrow: "Instruções enviadas",
    checkYourEmailTitle: "Verifique seu e-mail",
    checkYourEmailDescription: "Se houver uma conta associada a esse e-mail, você receberá um link válido por 30 minutos.",
    sendingInstructionsLabel: "Enviando...",
    sendInstructionsLabel: "Enviar instruções",
    recoveryServerTimeout: "O servidor está demorando demais para responder.",
    recoveryServerUnavailable: "Não foi possível conectar ao servidor. Tente novamente.",
    recoveryRequestFailed: "Não foi possível enviar as instruções. Tente novamente.",
    forgotPasswordLink: "Esqueceu sua senha?",
    resetBrandPromise: "Proteja sua conta com uma nova senha.",
    resetPasswordEyebrow: "Recuperação de acesso",
    resetPasswordTitle: "Crie uma nova senha",
    resetPasswordDescription: "Escolha uma senha diferente da que você usava antes.",
    newPasswordLabel: "Nova senha",
    passwordStrengthLabel: "Segurança",
    passwordRequirements: "Use pelo menos 10 caracteres e evite seu nome, e-mail ou senha anterior.",
    confirmNewPasswordLabel: "Confirmar senha",
    passwordConfirmationValidation: "As senhas devem ser iguais.",
    resetCompleteEyebrow: "Acesso recuperado",
    passwordUpdatedTitle: "Senha atualizada",
    passwordUpdatedDescription: "Agora você pode entrar com sua nova senha.",
    signInAction: "Entrar",
    expiredTokenTitle: "Link expirado",
    expiredTokenMessage: "Este link expirou. Solicite um novo.",
    requestAnotherLink: "Solicitar outro link",
    usedTokenTitle: "Link já utilizado",
    usedTokenMessage: "Este link já foi utilizado. Você pode entrar ou solicitar outro.",
    networkErrorTitle: "Sem conexão com o servidor",
    tryAgainAction: "Tentar novamente",
    passwordStrengthWeak: "Fraca",
    passwordStrengthAcceptable: "Aceitável",
    passwordStrengthStrong: "Forte",
    hidePasswordAction: "Ocultar",
    showPasswordAction: "Mostrar",
    resettingPasswordLabel: "Atualizando...",
    resetPasswordAction: "Redefinir senha",
    missingTokenTitle: "O link de recuperação está incompleto",
    invalidTokenTitle: "Link inválido",
    missingTokenMessage: "Abra o link completo que você recebeu por e-mail.",
    invalidTokenMessage: "Este link não é válido.",
    passwordReuseError: "Escolha uma senha diferente da anterior.",
    passwordPolicyError: "A senha não atende aos requisitos de segurança.",
    passwordResetRateLimit: "Muitas tentativas. Aguarde alguns minutos.",
    passwordResetFailed: "Não foi possível atualizar a senha. Tente novamente.",
    loginRateLimit: "Muitas tentativas de acesso. Aguarde um minuto e tente novamente.",
    passwordValidation: "A senha deve ter pelo menos 10 caracteres.",
    loginSwitch: "Ainda não tem uma conta? <x id=\"START_LINK\" ctype=\"x-a\" equiv-text=\"&lt;a routerLink=&quot;/register&quot;&gt;\"/>Crie uma<x id=\"CLOSE_LINK\" ctype=\"x-a\" equiv-text=\"&lt;/a&gt;\"/>",
    registerSwitch: "Já tem uma conta? <x id=\"START_LINK\" ctype=\"x-a\" equiv-text=\"&lt;a routerLink=&quot;/login&quot;&gt;\"/>Entre<x id=\"CLOSE_LINK\" ctype=\"x-a\" equiv-text=\"&lt;/a&gt;\"/>",
    clientHistoryEyebrow: "Relacionamento com o cliente", clientTimelineTitle: "Linha do tempo", clientTimelineAriaLabel: "Linha do tempo do cliente", openResourceAction: "Abrir", emptyClientTimeline: "A atividade do cliente aparecerá aqui quando você registrar interações, propostas ou eventos.",
    timelineClientCreated: "Cliente criado", timelineClientUpdated: "Dados do cliente atualizados", timelineClientArchived: "Cliente arquivado", timelineNote: "Nota registrada", timelineCall: "Ligação registrada", timelineEmail: "E-mail registrado", timelineMeeting: "Reunião registrada", timelineWhatsapp: "Conversa pelo WhatsApp", timelineQuotationCreated: "Proposta criada", timelineQuotationSent: "Proposta enviada", timelineQuotationApproved: "Proposta aprovada", timelineQuotationRejected: "Proposta rejeitada", timelineQuotationCancelled: "Proposta cancelada", timelineEventCreated: "Evento criado", timelineEventCompleted: "Evento concluído", timelineEventCancelled: "Evento cancelado", timelineResourceUpdated: "Atividade atualizada",
    clientProgressLabel: "Progresso do cliente", clientStepIdentity: "Tipo e identificação", clientStepContact: "Dados de contato", clientStepAddress: "Endereço", clientStepReview: "Revisão", clientReviewHelp: "Confirme as informações principais. Você poderá completar ou editar os dados depois.", saveBasicClientButton: "Salvar dados básicos", clientStepSingleValidationError: "Falta preencher ou corrigir 1 campo desta etapa.", clientStepValidationError: "Falta preencher ou corrigir {$fieldCount} campos desta etapa.",
    upcomingEventsMetric: "próximos eventos", expiringQuotationsMetric: "propostas próximas do vencimento", urgentTasksMetric: "tarefas prioritárias", clientsWithoutFollowUpMetric: "clientes para contatar", hideOnboardingButton: "Ocultar por enquanto", showOnboardingButton: "Ver guia de primeiros passos", todayAttentionEyebrow: "Requer atenção", todayAttentionTitle: "Prioridades operacionais", validUntilShortLabel: "Vence", noUrgentWork: "Não há tarefas urgentes nem propostas aguardando resposta.", upcomingEyebrow: "Em breve", upcomingEventsTitle: "Eventos na agenda", viewAllLink: "Ver todos", noUpcomingEvents: "Ainda não há próximos eventos. Crie um para organizar datas, tarefas e recursos.", organizationActivityEyebrow: "Trabalho da equipe", recentActivityTitle: "Atividade recente", onboardingDescription: "Conclua estas etapas para passar dos primeiros dados a uma operação pronta para trabalhar.",
    guidedOrganizationTitle: "Configure sua organização", guidedOrganizationDescription: "Defina identidade, país, moeda e fuso horário.", configureAction: "Configurar", guidedClientTitle: "Crie seu primeiro cliente", guidedClientDescription: "Cadastre a pessoa ou empresa com quem você trabalhará.", guidedCatalogTitle: "Adicione produtos ou serviços", guidedCatalogDescription: "Salve preços e unidades para criar propostas sem repetir trabalho.", guidedQuotationTitle: "Crie e envie uma proposta", guidedQuotationDescription: "Transforme as necessidades do cliente em uma proposta clara.", guidedApprovalTitle: "Registre a aprovação", guidedApprovalDescription: "Confirme a proposta que se transformará em trabalho operacional.", viewQuotationsAction: "Ver propostas", guidedEventTitle: "Crie seu primeiro evento", guidedEventDescription: "Organize datas, equipe, tarefas e recursos.",
    recommendedOrganizationTitle: "Conclua a configuração da organização", recommendedOrganizationDescription: "As informações regionais garantem o uso correto de datas, moeda e impostos.", recommendedSendQuotationTitle: "Envie sua primeira proposta", recommendedSendQuotationDescription: "Compartilhe com o cliente para iniciar o acompanhamento comercial.", recommendedApprovalTitle: "Registre a primeira aprovação", recommendedApprovalDescription: "Uma proposta aprovada pode ser transformada diretamente em um evento.", recommendedEventTitle: "Crie seu primeiro evento", recommendedEventDescription: "Organize a execução de uma proposta aprovada ou de um trabalho manual.", recommendedExpiringTitle: "Acompanhe uma proposta próxima do vencimento", recommendedExpiringDescription: "Uma resposta no prazo mantém a oportunidade ativa.", openQuotationAction: "Abrir proposta", recommendedUpcomingEventTitle: "Revise seu próximo evento", recommendedUpcomingEventDescription: "Confirme tarefas, participantes e recursos antes do início.", openEventAction: "Abrir evento", recommendedUrgentTaskTitle: "Resolva uma tarefa prioritária", recommendedUrgentTaskDescription: "Cuidar dela agora reduz os riscos do evento.", reviewTaskAction: "Revisar tarefa", recommendedFollowUpTitle: "Retome o contato com um cliente", recommendedFollowUpDescription: "Um breve acompanhamento pode abrir uma nova oportunidade.", openClientAction: "Abrir cliente", recommendedOpportunityTitle: "Crie uma nova oportunidade", recommendedOpportunityDescription: "Sua operação está em dia. Prepare a próxima proposta comercial.",
    eventProgressLabel: "Progresso do evento", eventStepMain: "Informações principais", eventStepMainHelp: "Escolha se deseja começar com uma proposta aprovada ou do zero.", eventSourceLabel: "Origem do evento", eventFromQuotationTitle: "A partir de uma proposta aprovada", eventFromQuotationHelp: "Reutilize o cliente, o orçamento e o contexto comercial.", manualEventTitle: "Evento manual", manualEventHelp: "Comece com informações básicas e complete depois.", selectQuotationOption: "Selecione uma proposta", eventNameExample: "Ex. Lançamento da temporada", eventDescriptionExample: "Objetivo e escopo principal", eventStepDateLocation: "Data e local", eventStepDateLocationHelp: "Defina quando e onde o trabalho acontecerá.", venueExample: "Ex. Espaço de eventos", eventStepTeamResources: "Equipe e recursos", eventStepTeamResourcesHelp: "Estes dados são opcionais. Você poderá adicionar mais participantes e recursos no evento.", initialParticipantLabel: "Participante inicial", participantNameExample: "Nome do participante", initialResourceLabel: "Recurso inicial", resourceNameExample: "Ex. Equipamento de som", resourceQuantityLabel: "Quantidade do recurso", eventStepTasks: "Tarefas iniciais", eventStepTasksHelp: "Você pode salvar sem tarefas e adicioná-las ao planejar a execução.", initialTaskLabel: "Primeira tarefa", initialTaskExample: "Ex. Confirmar fornecedores", priorityLow: "Baixa", priorityMedium: "Média", priorityHigh: "Alta", priorityUrgent: "Urgente", eventStepReview: "Revisão", eventStepReviewHelp: "Confirme as informações. O evento será salvo como rascunho para você continuar o planejamento.", afterEventCreationTitle: "Depois de criar", afterEventCreationHelp: "Você poderá adicionar mais tarefas, atribuir participantes e confirmar o evento nos detalhes.", createEventDraftButton: "Criar evento como rascunho", createFromQuotationConfirmTitle: "Criar evento a partir desta proposta", createFromQuotationConfirmDescription: "A Kaklen reutilizará o cliente, o orçamento e o contexto da proposta aprovada. Apenas um evento pode ser vinculado a ela.", createEventConfirmButton: "Criar evento", eventForQuotationPrefix: "Evento", eventStepSingleValidationError: "Falta preencher ou corrigir 1 campo desta etapa.", eventStepValidationError: "Falta preencher ou corrigir {$fieldCount} campos desta etapa.", eventOptionalSetupWarning: "O evento foi criado, mas não foi possível adicionar todos os dados opcionais. Você pode completá-los nos detalhes.",
    inviteFirstMemberAction: "Convidar o primeiro membro", membersEmptyTitle: "Sua equipe começa com você", membersEmptyDescription: "Convide pessoas para dividir tarefas e manter permissões claras na organização.", searchClientLabel: "Buscar cliente", searchClientPlaceholder: "Nome, e-mail ou RUT", createClientNewTabAction: "Criar cliente em outra aba", refreshClientsAction: "Atualizar clientes", searchCatalogLabel: "Buscar no catálogo", searchCatalogPlaceholder: "Nome, código ou SKU", duplicateLineButton: "Duplicar linha", termsExample: "Forma de pagamento, prazos e condições", quotationNotesExample: "Informações úteis para o cliente", quotationVerificationNote: "A Kaklen calculará e verificará automaticamente os totais ao salvar.", clientSummaryFallback: "Cliente cadastrado sem dados de contato", globalDiscountLabel: "Desconto global (%)", globalDiscountHelp: "Aplicado às linhas que não têm um desconto específico.",
    commandPaletteEyebrow: "Central de ações", globalSearchLabel: "Buscar clientes, catálogo, propostas e eventos", commandSearchPlaceholder: "Buscar ou digitar uma ação", searchingLabel: "Buscando...", searchMinimumHelp: "Digite pelo menos 2 caracteres.", recentActionsTitle: "Recentes", commandActionsTitle: "Criar e gerenciar", commandNavigationTitle: "Navegação", noSearchResultsTitle: "Nenhum resultado encontrado.", noSearchResultsHelp: "Tente outro nome, código ou número.", commandNavigateHelp: "para navegar", commandOpenHelp: "para abrir", commandCloseHelp: "para fechar", membersCommandHelp: "Gerenciar equipe e funções", settingsCommandHelp: "Configurar sua organização", globalSearchError: "Não foi possível concluir a busca. Tente novamente.", errorRutRequired: "O RUT é obrigatório para empresas chilenas.", noRecentActivity: "A atividade aparecerá aqui quando sua equipe começar a trabalhar.",
    activityClientCreated: "criou o cliente", activityClientUpdated: "atualizou o cliente", activityCatalogCreated: "adicionou ao catálogo", activityCatalogUpdated: "atualizou", activityQuotationCreated: "criou a proposta", activityQuotationSent: "enviou a proposta", activityQuotationApproved: "aprovou a proposta", activityQuotationRejected: "rejeitou a proposta", activityEventCreated: "criou o evento", activityEventCompleted: "concluiu o evento", activityOrganizationUpdated: "atualizou a organização", activityUpdated: "atualizou",
    clientsEmptyTitle: "Você ainda não tem clientes", clientsEmpty: "Crie o primeiro para preparar propostas, registrar conversas e organizar eventos.", catalogEmptyTitle: "Adicione seus produtos e serviços", catalogEmpty: "Salve preços, unidades e impostos para preparar propostas mais rapidamente.", quotationsEmptyTitle: "Crie sua primeira proposta", quotationsEmpty: "Prepare uma proposta e transforme-a em evento quando o cliente aprovar.", eventsEmptyTitle: "Organize seu primeiro evento", eventsEmpty: "Crie um manualmente ou comece com uma proposta aprovada para coordenar tarefas e recursos.", quotationFormDescription: "A Kaklen calculará e verificará automaticamente os totais ao salvar.",
    quotationCancelledLabel: "Cancelada", eventCompletedLabel: "Concluído", eventCancelledLabel: "Cancelado", taskCompletedLabel: "Concluída", taskCancelledLabel: "Cancelada", archiveCatalogDetailDialogTitle: "Arquivar item", archiveCatalogDetailDialogDescription: "O item não estará mais disponível para novas operações, mas suas informações históricas serão preservadas.", cityOrCommuneLabel: "Comuna ou cidade", onboardingCompletedLabel: "Concluído",
    openWeeklyEventAriaLabel: "Abrir evento {$eventName}, {$eventDate} às {$eventTime}", participantIdentityRequired: "Digite o nome ou o e-mail do participante.", eventDateValidation: "A data de término deve ser posterior à data de início.", quantityValidation: "A quantidade deve ser maior que 0 e ter no máximo 3 casas decimais.", budgetValidation: "O orçamento deve ser maior ou igual a 0 e ter no máximo 2 casas decimais.", eventConfirmedPluralLabel: "Confirmados", eventCompletedPluralLabel: "Concluídos", eventCancelledPluralLabel: "Cancelados",
    sendQuotationEmailTitle: "Enviar por e-mail", resendQuotationEmailButton: "Reenviar por e-mail", discountsTotalLabel: "Descontos", taxesTotalLabel: "Impostos", preparingPdfMessage: "Preparando PDF...", preparingPdfNotification: "Estamos preparando seu PDF.", pdfDownloadedSuccess: "Proposta baixada.", pdfDownloadError: "Não foi possível gerar o PDF. Tente novamente.", quotationEmailSentSuccess: "Proposta enviada por e-mail.", quotationEmailSendError: "Não foi possível enviar o e-mail. O estado da proposta não foi alterado.",
    approveQuotationDialogTitle: "Aprovar proposta", rejectQuotationDialogTitle: "Rejeitar proposta", approveQuotationDialogDescription: "A proposta será aprovada e poderá originar um evento.", rejectQuotationDialogDescription: "A proposta será rejeitada e esta decisão será registrada no histórico.", historyQuotationEmailed: "Proposta enviada por e-mail", historyQuotationVersionCreated: "Nova versão criada", historyQuotationCreated: "Proposta criada", historyQuotationSent: "Proposta enviada", historyQuotationApproved: "Proposta aprovada", historyQuotationRejected: "Proposta rejeitada", historyQuotationCancelled: "Proposta cancelada", historyQuotationUpdated: "Proposta atualizada", historyQuotationEmailedDescription: "Enviada por e-mail para {$recipient}", systemActorLabel: "Sistema",
    moneyValidation: "Digite um valor maior ou igual a 0 com no máximo 2 casas decimais.", discountValidation: "O desconto percentual deve estar entre 0 e 100.", quotationDateValidation: "A data de validade deve ser igual ou posterior à data de emissão.", itemsLabel: "Itens", quotationStepSingleValidationError: "Falta preencher ou corrigir 1 campo desta etapa.", quotationStepValidationError: "Falta preencher ou corrigir {$fieldCount} campos desta etapa.", quotationDraftPluralLabel: "Rascunhos", quotationSentPluralLabel: "Enviadas", quotationApprovedPluralLabel: "Aprovadas",
    sendQuotationEmailEyebrow: "E-mail da proposta", recipientEmailLabel: "Destinatário", messageLabel: "Mensagem", quotationPdfAttachmentHelp: "O PDF atualizado da proposta será anexado automaticamente.", sendEmailButton: "Enviar e-mail", sendingEmailButton: "Enviando...", quotationEmailDefaultSubject: "Proposta {$quotationNumber}", quotationEmailDefaultMessage: "Nossa proposta comercial está anexada para sua análise.",
    fieldRequiredError: "Este campo é obrigatório.", fieldInvalidError: "Revise o valor informado.", phoneValidation: "Digite um telefone válido com código do país, por exemplo +56 9 1234 5678.", dateOrderValidation: "A data de término deve ser igual ou posterior à data de início.", singleFieldMissingError: "Falta preencher ou corrigir 1 campo.", multipleFieldsMissingError: "Falta preencher ou corrigir {$fieldCount} campos."
  }
};

for (const locale of ["es", "en", "pt-BR"]) {
  const file = new URL(`messages.${locale}.xlf`, directory);
  const existing = parseUnits(readFileSync(file, "utf8"), true);
  const missing = [];
  const rendered = sourceUnits.map((unit) => {
    const rawTranslation = locale === "es" ? unit.source : translations[locale][unit.id] ?? existing.get(unit.id)?.target;
    if (rawTranslation === undefined) {
      missing.push(`${unit.id}: ${stripXml(unit.source)}`);
      return "";
    }
    const translated = restoreLegacyPlaceholders(rawTranslation, unit.source);
    assertPlaceholders(unit.id, unit.source, translated);
    return `      <trans-unit id="${unit.id}" datatype="html">\n        <source>${unit.source}</source>\n        <target>${escapeTarget(translated)}</target>\n      </trans-unit>`;
  });
  if (missing.length > 0) throw new Error(`Missing ${locale} translations:\n${missing.join("\n")}`);
  const document = `<?xml version="1.0" encoding="UTF-8" ?>\n<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n  <file source-language="es" target-language="${locale}" datatype="plaintext" original="ng2.template">\n    <body>\n${rendered.join("\n")}\n    </body>\n  </file>\n</xliff>\n`;
  writeFileSync(file, document, "utf8");
  console.log(`✓ ${locale}: ${sourceUnits.length} translations`);
}

function parseUnits(source, includeTarget) {
  const units = new Map();
  for (const match of source.matchAll(/<trans-unit id="([^"]+)"[^>]*>[\s\S]*?<source>([\s\S]*?)<\/source>([\s\S]*?)<\/trans-unit>/g)) {
    const target = includeTarget ? match[3].match(/<target>([\s\S]*?)<\/target>/)?.[1] : undefined;
    units.set(match[1], { id: match[1], source: match[2], target });
  }
  return includeTarget ? units : [...units.values()];
}

function escapeTarget(value) {
  if (value.includes("<x ")) return value;
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function assertPlaceholders(id, source, target) {
  const sourceIds = [...source.matchAll(/<x id="([^"]+)"/g)].map((match) => match[1]).sort();
  const targetIds = [...target.matchAll(/<x id="([^"]+)"/g)].map((match) => match[1]).sort();
  if (sourceIds.join("|") !== targetIds.join("|")) throw new Error(`Placeholder mismatch for ${id}`);
}

function restoreLegacyPlaceholders(target, source) {
  const sourcePlaceholders = [...source.matchAll(/(<x id="[^"]+"[^>]*\/>)/g)].map((match) => match[1]);
  let index = 0;
  return target.replace(/\{\$([^}]+)\}/g, (value) => sourcePlaceholders[index++] ?? value);
}

function stripXml(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
