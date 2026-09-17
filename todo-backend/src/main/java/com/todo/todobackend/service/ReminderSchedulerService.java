package com.todo.todobackend.service;

import com.todo.todobackend.model.Todo;
import com.todo.todobackend.repository.TodoRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ReminderSchedulerService {

    private final TodoRepository todoRepository;
    private final EmailService emailService;

    public ReminderSchedulerService(TodoRepository todoRepository, EmailService emailService) {
        this.todoRepository = todoRepository;
        this.emailService = emailService;
    }

    /**
     * Runs every 60 seconds to check for pending email reminders that are due.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void processPendingReminders() {
        LocalDateTime now = LocalDateTime.now();
        List<Todo> dueReminders = todoRepository.findPendingEmailReminders(now);

        if (dueReminders.isEmpty()) {
            return;
        }

        System.out.println("⏰ [REMINDER SERVICE] Found " + dueReminders.size() + " due reminder(s) to process at " + now);

        for (Todo todo : dueReminders) {
            try {
                if (todo.getUser() != null && todo.getUser().getEmail() != null) {
                    String userEmail = todo.getUser().getEmail();
                    emailService.sendTaskReminderEmail(userEmail, todo);
                }
                todo.setReminderSent(true);
                todoRepository.save(todo);
            } catch (Exception e) {
                System.err.println("⚠️ Error processing reminder for todo ID " + todo.getId() + ": " + e.getMessage());
            }
        }
    }
}
